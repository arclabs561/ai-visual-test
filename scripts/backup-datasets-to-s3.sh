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

# Auto-stabilization: Adaptive worker count based on system capabilities
# Strategy: Start conservatively, increase if stable, restart with fewer workers if errors too high
INITIAL_WORKERS=800  # Start slightly below max to reduce port exhaustion
MAX_WORKERS=1000
MIN_WORKERS=256
MAX_ERROR_RATE=8  # Percentage threshold for reducing workers
STABLE_ERROR_RATE=2  # Below this, can increase workers

echo "Backing up with auto-stabilizing parallel workers..."
echo "Initial workers: $INITIAL_WORKERS (will adapt based on error rate)"
echo ""

# Function to run backup with specified worker count
run_backup() {
  local workers=$1
  echo "[Backup] Starting with $workers workers..." | tee -a "$LOG_FILE"
  
  # s5cmd handles recursive wildcards efficiently with built-in parallelization
  # Using --if-size-differ to skip already-uploaded files (resumable)
  # Using --stat to get execution statistics
  # --retry-count: Increased to 20 for better resilience
  # Note: "can't assign requested address" errors indicate port exhaustion
  # s5cmd doesn't auto-retry these, so we handle via worker adjustment
  s5cmd --numworkers $workers --retry-count 20 --stat cp --if-size-differ "${SOURCE_DIR}/*" "${S3_BUCKET}" 2>&1 | tee -a "$LOG_FILE"
  return ${PIPESTATUS[0]}
}

# Function to check error rate in recent log entries
check_error_rate() {
  if [ ! -f "$LOG_FILE" ] || [ ! -s "$LOG_FILE" ]; then
    echo "0"
    return
  fi
  
  local recent_lines=3000
  local total=$(tail -n $recent_lines "$LOG_FILE" 2>/dev/null | wc -l | tr -d ' ')
  local errors=$(tail -n $recent_lines "$LOG_FILE" 2>/dev/null | grep -c "ERROR" || echo "0")
  
  if [ "$total" -gt 100 ]; then
    echo $((errors * 100 / total))
  else
    echo "0"
  fi
}

# Auto-stabilization loop: Run backup, check errors, adjust and retry if needed
CURRENT_WORKERS=$INITIAL_WORKERS
ATTEMPT=1
MAX_ATTEMPTS=5

while [ $ATTEMPT -le $MAX_ATTEMPTS ]; do
  # Run backup with current worker count
  run_backup $CURRENT_WORKERS
  BACKUP_EXIT=$?
  
  # Check error rate
  ERROR_RATE=$(check_error_rate)
  
  echo "[Auto-stabilize] Attempt $ATTEMPT: Error rate: ${ERROR_RATE}% | Workers: $CURRENT_WORKERS" | tee -a "$LOG_FILE"
  
  # If error rate is acceptable and backup succeeded, we're done
  if [ "$ERROR_RATE" -le "$STABLE_ERROR_RATE" ] && [ $BACKUP_EXIT -eq 0 ]; then
    echo "[Auto-stabilize] Backup completed successfully with stable error rate" | tee -a "$LOG_FILE"
    break
  fi
  
  # If error rate too high, reduce workers and retry
  if [ "$ERROR_RATE" -gt "$MAX_ERROR_RATE" ] && [ "$CURRENT_WORKERS" -gt "$MIN_WORKERS" ]; then
    CURRENT_WORKERS=$((CURRENT_WORKERS - 200))
    if [ "$CURRENT_WORKERS" -lt "$MIN_WORKERS" ]; then
      CURRENT_WORKERS=$MIN_WORKERS
    fi
    echo "[Auto-stabilize] Error rate too high, reducing workers to $CURRENT_WORKERS and retrying..." | tee -a "$LOG_FILE"
    ATTEMPT=$((ATTEMPT + 1))
    continue
  fi
  
  # If error rate is low but backup failed, try increasing workers slightly
  if [ "$ERROR_RATE" -lt "$STABLE_ERROR_RATE" ] && [ "$CURRENT_WORKERS" -lt "$MAX_WORKERS" ] && [ $BACKUP_EXIT -ne 0 ]; then
    CURRENT_WORKERS=$((CURRENT_WORKERS + 100))
    if [ "$CURRENT_WORKERS" -gt "$MAX_WORKERS" ]; then
      CURRENT_WORKERS=$MAX_WORKERS
    fi
    echo "[Auto-stabilize] Low error rate but backup failed, trying with $CURRENT_WORKERS workers..." | tee -a "$LOG_FILE"
    ATTEMPT=$((ATTEMPT + 1))
    continue
  fi
  
  # If we get here, either backup succeeded or we've exhausted attempts
  break
done

if [ $ATTEMPT -gt $MAX_ATTEMPTS ]; then
  echo "[Auto-stabilize] Warning: Reached max attempts, backup may be incomplete" | tee -a "$LOG_FILE"
  exit 1
fi

echo ""
echo "Backup complete. Verify with:"
echo "  s5cmd ls $S3_BUCKET --recursive | wc -l"
echo "  s5cmd du $S3_BUCKET"

