from app.processing.recovery import recovery_outcome


def test_expired_processing_jobs_requeue_within_the_attempt_budget() -> None:
    assert recovery_outcome(attempt_count=1, max_attempts=3) == "queued"


def test_expired_processing_jobs_fail_after_the_attempt_budget() -> None:
    assert recovery_outcome(attempt_count=3, max_attempts=3) == "failed"
