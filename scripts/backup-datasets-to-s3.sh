#!/bin/bash
# Backup dataset files to S3 using s5cmd (optimized for parallel uploads with auto-stabilization)
# Usage: ./scripts/backup-datasets-to-s3.sh

set -e

SOURCE_DIR="evaluation/datasets/human-annotated"
S3_BUCKET="s3://arclabs-backups/ai-visual-test/datasets/human-annotated/"
LOG_FILE="/tmp/s3-backup-optimized.log"

if [ ! -d "$SOURCE_DIR" ]; then
  echo "Error: Source directory $SOURCE_DIR does not exist"
  exit 1
fi

if ! command -v s5cmd &> /dev/null; then
  echo "Error: s5cmd not found. Install with: brew install s5cmd"
  exit 1
fi

echo "Starting optimized backup of $SOURCE_DIR to $S3_BUCKET"
echo "Files: $(find "${SOURCE_DIR}" -type f | wc -l | tr -d ' ')"
echo "Size: $(du -sh "${SOURCE_DIR}" 2>/dev/null | awk '{print $1}')"
echo ""

# Auto-stabilization: Start with high parallelism, reduce if error rate too high
# Strategy: Monitor error rate and adjust workers dynamically
INITIAL_WORKERS=1000
MIN_WORKERS=256
CURRENT_WORKERS=$INITIAL_WORKERS
MAX_ERROR_RATE=10  # Percentage threshold for reducing workers

echo "Backing up with adaptive parallel workers (auto-stabilizing)..."
echo "Initial workers: $INITIAL_WORKERS"
echo ""

# Function to check error rate and adjust workers
check_and_adjust() {
  if [ ! -f "$LOG_FILE" ] || [ ! -s "$LOG_FILE" ]; then
    return
  fi
  
  local recent_lines=5000
  local total=$(tail -n $recent_lines "$LOG_FILE" 2>/dev/null | wc -l | tr -d ' ')
  local errors=$(tail -n $recent_lines "$LOG_FILE" 2>/dev/null | grep -c "ERROR" || echo "0")
  
  if [ "$total" -gt 100 ]; then
    local error_rate=$((errors * 100 / total))
    
    if [ "$error_rate" -gt "$MAX_ERROR_RATE" ] && [ "$CURRENT_WORKERS" -gt "$MIN_WORKERS" ]; then
      CURRENT_WORKERS=$((CURRENT_WORKERS - 200))
      if [ "$CURRENT_WORKERS" -lt "$MIN_WORKERS" ]; then
        CURRENT_WORKERS=$MIN_WORKERS
      fi
      echo "[Auto-stabilize] Error rate: ${error_rate}% | Reducing workers to: $CURRENT_WORKERS" | tee -a "$LOG_FILE"
    elif [ "$error_rate" -lt 3 ] && [ "$CURRENT_WORKERS" -lt "$INITIAL_WORKERS" ]; then
      CURRENT_WORKERS=$((CURRENT_WORKERS + 100))
      if [ "$CURRENT_WORKERS" -gt "$INITIAL_WORKERS" ]; then
        CURRENT_WORKERS=$INITIAL_WORKERS
      fi
      echo "[Auto-stabilize] Error rate: ${error_rate}% | Increasing workers to: $CURRENT_WORKERS" | tee -a "$LOG_FILE"
    fi
  fi
}

# Run backup with monitoring and auto-adjustment
# Use background monitoring process to check error rate periodically
(
  while true; do
    sleep 30
    check_and_adjust
    # Check if main process is still running
    if ! ps aux | grep -q "[s]5cmd.*numworkers"; then
      break
    fi
  done
) &
MONITOR_PID=$!

# Main backup command with current worker count
# s5cmd handles recursive wildcards efficiently with built-in parallelization
# Using --if-size-differ to skip already-uploaded files (resumable)
# Using --stat to get execution statistics
# --retry-count: s5cmd's built-in retry (default: 10)
s5cmd --numworkers $CURRENT_WORKERS --retry-count 20 --stat cp --if-size-differ "${SOURCE_DIR}/*" "${S3_BUCKET}" 2>&1 | tee "$LOG_FILE"

# Cleanup monitor process
kill $MONITOR_PID 2>/dev/null || true

echo ""
echo "Backup complete. Verify with:"
echo "  s5cmd ls $S3_BUCKET --recursive | wc -l"
echo "  s5cmd du $S3_BUCKET"

