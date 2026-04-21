---
type: script
command: "python3 -c \"import matplotlib; exec(open('{script}').read())\""
parameters:
  script:
    type: string
    description: "Path to a Python script that generates the chart"
    required: true
  output:
    type: string
    description: "Output file path for the chart image"
    default: "chart.png"
---
# Generate Chart

Create charts and visualizations from data using matplotlib. Pass a Python script that produces a chart file.
