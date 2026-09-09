# Uses only the declared base/recommended R distribution packages.
x <- utils::read.csv('results/transformed.csv', na.strings = '', stringsAsFactors = FALSE)
stopifnot(!anyDuplicated(x$participant_id))
values <- x$score[!is.na(x$score)]
writeLines(sprintf('{"rowCount":%d,"validCount":%d,"missingCount":%d,"sum":%.17g,"mean":%.17g}',
    nrow(x), length(values), sum(is.na(x$score)), sum(values), mean(values)), 'results/r.json')
