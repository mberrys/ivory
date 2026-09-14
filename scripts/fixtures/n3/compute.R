input <- read.csv("/var/tmp/input.csv")
result <- sprintf('{"mean":%.17g,"rowCount":%d,"sum":%.17g}\n', mean(input$value), nrow(input), sum(input$value))
writeLines(result, "/tmp/result.json")
cat("N3_RESULT_RECORDED\n")
