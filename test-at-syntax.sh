#!/bin/bash
# Test if @ syntax works in pipe mode

echo "Testing @ syntax in pipe mode..."
echo "@IMPLEMENTATION_PLAN.md What is the status of Task 6?" | claude -p
