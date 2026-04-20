---
type: script
command: "time {command} 2>&1"
parameters:
  command:
    type: string
    description: "Command or script to benchmark"
    required: true
  iterations:
    type: number
    description: "Number of times to run the command"
    default: 1
---
# Measure Performance

Measure execution time, memory usage, or throughput of a command or script. Use for benchmarking, performance regression detection, or capacity planning.
