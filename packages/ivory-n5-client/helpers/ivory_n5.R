# N5 HTTP helper. JSON stays text to preserve arrays/nulls/numeric precision.
# Requires httr2; never starts a service or writes records.
ivory_request <- function(path, body = NULL, key = NULL) {
    if (!requireNamespace("httr2", quietly = TRUE)) stop("Install httr2 in the candidate R environment")
    base <- sub("/$", "", Sys.getenv("IVORY_N5_SERVICE_URL", "http://127.0.0.1:4100"))
    req <- httr2::request(paste0(base, path))
    req <- httr2::req_headers(req, Accept = "application/json")
    req <- httr2::req_options(req, followlocation = FALSE)
    req <- httr2::req_timeout(req, 30)
    req <- httr2::req_error(req, is_error = function(resp) FALSE)
    if (!is.null(body)) {
        if (is.null(key) || !nzchar(trimws(key))) stop("Supply and retain an Idempotency-Key")
        req <- httr2::req_headers(req, `Idempotency-Key` = key)
        if (!is.character(body) || length(body) != 1L) stop("Pass the complete request as JSON text")
        req <- httr2::req_body_raw(req, body, type = "application/json")
    }
    resp <- httr2::req_perform(req)
    payload <- httr2::resp_body_string(resp)
    if (httr2::resp_status(resp) >= 300) {
        stop(structure(list(message = paste("Service HTTP", httr2::resp_status(resp)),
                            status = httr2::resp_status(resp), body = payload),
                       class = c("ivory_http_error", "error", "condition")))
    }
    payload
}
ivory_submit <- function(body, key) ivory_request("/v1/executions", body, key)
ivory_get <- function(id) ivory_request(paste0("/v1/executions/", utils::URLencode(id, reserved = TRUE)))

if (sys.nframe() == 0L) {
    args <- commandArgs(trailingOnly = TRUE)
    result <- if (identical(args, "ready")) ivory_request("/health/ready") else if (length(args) == 2L && args[1] == "get") {
        ivory_get(args[2])
    } else if (length(args) == 3L && args[1] == "submit") {
        ivory_submit(paste(readLines(args[2], warn = FALSE, encoding = "UTF-8"), collapse = "\n"), args[3])
    } else stop("Usage: ivory_n5.R ready | get ID | submit REQUEST.json KEY; N5 project/citation/RunSpec/edit contracts are blocked")
    cat(result, "\n")
}
