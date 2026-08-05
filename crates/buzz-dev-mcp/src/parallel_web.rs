//! Parallel-powered web tools for Buzz agents.
//!
//! The MCP surface intentionally follows Parallel's Search and Extract APIs
//! closely. This keeps results structured, preserves Search/Extract sessions,
//! and avoids provider-specific behavior in the selected agent harness.

use parallel_web::extract::{AdvancedExtractSettings, ExtractRequest};
use parallel_web::search::{AdvancedSearchSettings, SearchMode, SearchRequest};
use parallel_web::{Client, Error as ParallelError, FullContent};
use rmcp::ErrorData;
use schemars::JsonSchema;
use serde::Deserialize;

const MAX_SEARCH_RESULTS: u32 = 20;
const MAX_FETCH_URLS: usize = 20;

/// Search quality and latency preset exposed to MCP clients.
#[derive(Debug, Clone, Copy, Deserialize, JsonSchema)]
#[serde(rename_all = "lowercase")]
pub enum WebSearchMode {
    /// Lowest latency and cost.
    Turbo,
    /// Low latency for interactive agent loops.
    Basic,
    /// Highest-quality retrieval and compression.
    Advanced,
}

impl From<WebSearchMode> for SearchMode {
    fn from(value: WebSearchMode) -> Self {
        match value {
            WebSearchMode::Turbo => Self::Turbo,
            WebSearchMode::Basic => Self::Basic,
            WebSearchMode::Advanced => Self::Advanced,
        }
    }
}

/// Parameters for the `web_search` MCP tool.
#[derive(Debug, Deserialize, JsonSchema)]
pub struct WebSearchParams {
    /// Natural-language goal for the search. Include what the answer should
    /// establish and any source or freshness preferences.
    pub objective: String,
    /// One or more concise keyword queries used to retrieve candidate pages.
    pub search_queries: Vec<String>,
    /// Search quality/latency preset. Parallel defaults to `advanced`.
    #[serde(default)]
    pub mode: Option<WebSearchMode>,
    /// Maximum number of ranked results, from 1 through 20. Defaults to 10.
    #[serde(default)]
    pub max_results: Option<u32>,
    /// Maximum total excerpt characters returned across all results.
    #[serde(default)]
    pub max_chars_total: Option<u64>,
    /// Session ID returned by an earlier Parallel Search or Extract call.
    #[serde(default)]
    pub session_id: Option<String>,
    /// Model that will consume the results, when known.
    #[serde(default)]
    pub client_model: Option<String>,
}

/// Parameters for the `web_fetch` MCP tool.
#[derive(Debug, Deserialize, JsonSchema)]
pub struct WebFetchParams {
    /// Public HTTP(S) URLs to fetch. Parallel accepts up to 20 per call.
    pub urls: Vec<String>,
    /// Natural-language goal used to focus the returned excerpts.
    #[serde(default)]
    pub objective: Option<String>,
    /// Optional keyword queries used to focus the returned excerpts.
    #[serde(default)]
    pub search_queries: Vec<String>,
    /// Maximum total excerpt characters returned across all URLs.
    #[serde(default)]
    pub max_chars_total: Option<u64>,
    /// Return full page Markdown in addition to focused excerpts.
    #[serde(default)]
    pub full_content: bool,
    /// Session ID returned by an earlier Parallel Search or Extract call.
    #[serde(default)]
    pub session_id: Option<String>,
    /// Model that will consume the results, when known.
    #[serde(default)]
    pub client_model: Option<String>,
}

/// Execute a Parallel Search call and return its structured response as JSON.
pub async fn search(params: WebSearchParams) -> Result<String, ErrorData> {
    let request = build_search_request(params).map_err(invalid_params)?;
    let response = client()?.search(request).await.map_err(api_error)?;
    serde_json::to_string_pretty(&response).map_err(serialization_error)
}

/// Execute a Parallel Extract call and return its structured response as JSON.
pub async fn fetch(params: WebFetchParams) -> Result<String, ErrorData> {
    let request = build_fetch_request(params).map_err(invalid_params)?;
    let response = client()?.extract(request).await.map_err(api_error)?;
    serde_json::to_string_pretty(&response).map_err(serialization_error)
}

fn client() -> Result<Client, ErrorData> {
    Client::from_env().map_err(api_error)
}

fn build_search_request(params: WebSearchParams) -> Result<SearchRequest, String> {
    let objective = non_empty("objective", params.objective)?;
    let search_queries = non_empty_values("search_queries", params.search_queries)?;

    if let Some(max_results) = params.max_results {
        if !(1..=MAX_SEARCH_RESULTS).contains(&max_results) {
            return Err(format!(
                "max_results must be between 1 and {MAX_SEARCH_RESULTS}"
            ));
        }
    }

    let mut request = SearchRequest::new(search_queries).objective(objective);
    request.mode = params.mode.map(Into::into);
    request.max_chars_total = params.max_chars_total;
    request.session_id = optional_non_empty("session_id", params.session_id)?;
    request.client_model = optional_non_empty("client_model", params.client_model)?;
    if params.max_results.is_some() {
        request.advanced_settings = Some(AdvancedSearchSettings {
            max_results: params.max_results,
            ..AdvancedSearchSettings::default()
        });
    }
    Ok(request)
}

fn build_fetch_request(params: WebFetchParams) -> Result<ExtractRequest, String> {
    if params.urls.is_empty() {
        return Err("urls must contain at least one URL".to_owned());
    }
    if params.urls.len() > MAX_FETCH_URLS {
        return Err(format!(
            "urls cannot contain more than {MAX_FETCH_URLS} URLs"
        ));
    }
    let urls = non_empty_values("urls", params.urls)?;
    let search_queries = if params.search_queries.is_empty() {
        None
    } else {
        Some(non_empty_values("search_queries", params.search_queries)?)
    };

    let mut request = ExtractRequest::new(urls);
    request.objective = optional_non_empty("objective", params.objective)?;
    request.search_queries = search_queries;
    request.max_chars_total = params.max_chars_total;
    request.session_id = optional_non_empty("session_id", params.session_id)?;
    request.client_model = optional_non_empty("client_model", params.client_model)?;
    if params.full_content {
        request.advanced_settings = Some(AdvancedExtractSettings {
            full_content: Some(FullContent::Enabled(true)),
            ..AdvancedExtractSettings::default()
        });
    }
    Ok(request)
}

fn non_empty(field: &str, value: String) -> Result<String, String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        Err(format!("{field} must not be empty"))
    } else {
        Ok(trimmed.to_owned())
    }
}

fn optional_non_empty(field: &str, value: Option<String>) -> Result<Option<String>, String> {
    value.map(|value| non_empty(field, value)).transpose()
}

fn non_empty_values(field: &str, values: Vec<String>) -> Result<Vec<String>, String> {
    if values.is_empty() {
        return Err(format!("{field} must contain at least one value"));
    }
    values
        .into_iter()
        .enumerate()
        .map(|(index, value)| non_empty(&format!("{field}[{index}]"), value))
        .collect()
}

fn invalid_params(message: String) -> ErrorData {
    ErrorData::invalid_params(message, None)
}

fn api_error(error: ParallelError) -> ErrorData {
    let message = match error.ref_id() {
        Some(ref_id) => format!("{error} (Parallel reference ID: {ref_id})"),
        None => error.to_string(),
    };
    ErrorData::internal_error(message, None)
}

fn serialization_error(error: serde_json::Error) -> ErrorData {
    ErrorData::internal_error(
        format!("failed to serialize Parallel response: {error}"),
        None,
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    fn search_params() -> WebSearchParams {
        WebSearchParams {
            objective: "Find current Buzz documentation".to_owned(),
            search_queries: vec!["Block Buzz agent workspace".to_owned()],
            mode: Some(WebSearchMode::Basic),
            max_results: Some(5),
            max_chars_total: Some(8_000),
            session_id: Some("session-1".to_owned()),
            client_model: Some("test-model".to_owned()),
        }
    }

    #[test]
    fn search_params_map_to_parallel_request() {
        let request = build_search_request(search_params()).expect("valid request");
        assert_eq!(
            request.objective.as_deref(),
            Some("Find current Buzz documentation")
        );
        assert_eq!(request.search_queries, ["Block Buzz agent workspace"]);
        assert_eq!(request.mode, Some(SearchMode::Basic));
        assert_eq!(request.max_chars_total, Some(8_000));
        assert_eq!(request.session_id.as_deref(), Some("session-1"));
        assert_eq!(request.client_model.as_deref(), Some("test-model"));
        assert_eq!(
            request
                .advanced_settings
                .and_then(|settings| settings.max_results),
            Some(5)
        );
    }

    #[test]
    fn search_rejects_out_of_range_result_count() {
        let mut params = search_params();
        params.max_results = Some(21);
        let error = build_search_request(params).expect_err("invalid max_results");
        assert!(error.contains("between 1 and 20"));
    }

    #[test]
    fn fetch_params_map_to_parallel_request() {
        let request = build_fetch_request(WebFetchParams {
            urls: vec!["https://github.com/block/buzz".to_owned()],
            objective: Some("Summarize agent architecture".to_owned()),
            search_queries: vec!["MCP ACP".to_owned()],
            max_chars_total: Some(10_000),
            full_content: true,
            session_id: Some("session-1".to_owned()),
            client_model: None,
        })
        .expect("valid request");

        assert_eq!(request.urls, ["https://github.com/block/buzz"]);
        assert_eq!(request.search_queries, Some(vec!["MCP ACP".to_owned()]));
        assert_eq!(request.max_chars_total, Some(10_000));
        assert!(matches!(
            request
                .advanced_settings
                .and_then(|settings| settings.full_content),
            Some(FullContent::Enabled(true))
        ));
    }

    #[test]
    fn fetch_rejects_empty_urls() {
        let error = build_fetch_request(WebFetchParams {
            urls: Vec::new(),
            objective: None,
            search_queries: Vec::new(),
            max_chars_total: None,
            full_content: false,
            session_id: None,
            client_model: None,
        })
        .expect_err("empty URL list");
        assert!(error.contains("at least one URL"));
    }
}
