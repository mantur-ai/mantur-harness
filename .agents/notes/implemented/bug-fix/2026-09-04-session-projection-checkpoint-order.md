# Agent Note: Session projection checkpoints preserve request order

Status: implemented

English | [中文](2026-09-04-session-projection-checkpoint-order.zh.md)

## Problem

Session creation and `turn/end` can request projection-cache checkpoints close together. Each request captures its projection rows synchronously and then awaits the session-log durability barrier before writing the cache record. Without ordering before that await, the newer request can finish its log flush and write first, after which the older creation cut can overwrite it. The durable cache then remains stale even though the newer checkpoint reported no error.

## Decision

`SessionProjectionCache.write` captures the projection rows at invocation and enters the complete flush-and-write operation on a queue owned by that live `Session`. Requests therefore reach the log durability barrier and storage-domain write in invocation order. A failed request settles its own caller and does not prevent the next queued request from running. Plugin disposal removes the event producers, drains captured checkpoint requests, and then closes the storage domain.

The queue is keyed by the live `Session`, not only its id. A later lifecycle that reuses an id cannot wait on or inherit the write state of the earlier lifecycle.

## Alternatives considered

**Capture the projection rows after flushing the log.** Rejected because events can enter the live projection while the flush is pending. Capturing afterward could write projection state derived from events outside the completed durability barrier, allowing the cache to lead the log.

**Discard a write by comparing its row watermarks with the stored record.** Rejected because a checkpoint replaces all projection rows as one record. Per-row comparison would create merge semantics that the projection registry and storage format do not define.

**Rely only on the storage-domain write chain.** Rejected because requests join that chain after their independent log flushes. The domain preserves arrival order, not the earlier checkpoint-invocation order.

## Consequences

Overlapping mandatory and throttled checkpoints for one live session cannot regress the stored projection cut. Checkpoints for different sessions remain independent. Each caller still receives its own write failure, background callers still contain failures, and the next queued request still self-heals. The session log, cache document format, configuration, and public service API are unchanged. A focused test holds the creation flush open while `turn/end` requests a newer checkpoint and verifies that only the newer cut remains stored.
