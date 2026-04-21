---
name: data-quality-poor
type: condition
check: "The input data contains one or more quality issues: missing required fields exceeding 10% of records, duplicate entries, values outside expected ranges, inconsistent formats, or data validation errors that would compromise analysis accuracy"
narrativeTemplate:
  prefix: "If data quality is poor,"
  suffix: "route to data cleaning before analysis."
---
# Data Quality Poor

The input data has significant quality issues (missing values, inconsistencies, outliers). Route to a cleaning/validation step before proceeding with analysis.
