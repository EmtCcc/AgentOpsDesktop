# Leader Reactivation Mechanism - Design Spec

**Issue**: CMPAAA-327
**Author**: UI & Brand Designer
**Date**: 2026-05-29
**Status**: Implemented

## Problem

When a squad leader delegates tasks to members via the MessageBus, there was no mechanism to:
1. Route member completion output back to the leader agent
2. Notify the leader that a member finished so it can decide next steps
3. Show in the UI the delegation flow and leader reactivation state

## Architecture

### Bus Message Flow (Backend)

```
Leader Agent
  |-- delegateTask(targetAgentId, payload)
  |        |
  |        v
  |   squad.{squadId}.delegate  -->  Orchestrator spawns member
  |                                      |
  |                                      v
  |                              Member Agent runs task
  |                                      |
  |                                      v
  |                              member.complete(result)
  |                                      |
  |                                      v
  |   squad.{squadId}.complete  -->  Orchestrator receives
  |                                      |
  |                                      +-- emits squad:member-complete
  |                                      +-- calls _reactivateLeader()
  |                                              |
  |                                              v
  |   squad.{squadId}.member-result  --> Leader receives output
  |
  v
Leader decides: delegate more or finish
```

### New Bus Topic: `squad.{squadId}.member-result`

Published by `_reactivateLeader()` when a member completes or errors:

```json
{
  "memberAgentId": "agent-xyz",
  "status": "completed|error",
  "result": { ... },
  "error": null | "error message",
  "timestamp": 1685340000000
}
```

The leader subscribes to `member-result` via the SocketBusClient (auto-namespaced to `squad.{squadId}.member-result`).

## Files Changed

### Backend

| File | Change |
|------|--------|
| `src/main/task-orchestrator.js` | Added `_squadLeaders` map, `_reactivateLeader()` method, wired to `complete`/`error` subscriptions, cleanup in `_unsubscribeDelegation()` |
| `src/main/ipc/index.js` | Forward `squad:leader-reactivated`, `squad:member-complete`, `squad:member-spawned` events to renderer |
| `src/main/preload.js` | Added `squads.onEvent()` listener for `squad:event` IPC channel |

### Frontend

| File | Change |
|------|--------|
| `src/renderer/pages/SquadsPage.jsx` | Added `reactivatingSquads` state, `memberProgress` tracking, squad event listener, reactivation indicator + member progress display on SquadCard |
| `src/renderer/styles/pages.css` | Added `.spin` and `.squad-reactivating` animations |

## UI Changes

### SquadCard - Leader Reactivation Indicator

When a member completes, the orchestrator publishes `member-result` to the bus and emits `squad:leader-reactivated`. The UI shows:
- A pulsing "Leader reactivating" indicator with a spinning refresh icon (auto-clears after 3s)
- Member completion progress: "3/5 members done"

### Visual Design

```css
.squad-reactivating {
  color: var(--color-primary);
  font-weight: 500;
  animation: pulse-glow 1.5s ease-in-out infinite;
}
```

## Acceptance Criteria

| Criterion | Status |
|-----------|--------|
| Leader 在 member 完成后被重新激活 | Done - orchestrator publishes `member-result` to bus |
| Leader 收到所有 member 输出 | Done - `member-result` includes full `result` payload |
| Leader 可决定完成或继续委派 | Done - leader agent subscribes to `member-result`, decides next action |

## Remaining Work (Engineer)

- Leader agent code must subscribe to `member-result` topic and handle incoming results
- Leader agent must decide when all members are done and call `complete()` to finish the squad task
