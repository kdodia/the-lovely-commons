import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { appStore, STORAGE_KEY } from '$lib/store';
import { migrateState } from '$lib/store/persistence';
import { initialAppState } from './mockData';
import { scenarios, getScenario, type ScenarioId } from './scenarios';
import { rangesOverlap, todayLocalISO } from './dates';
import {
  canUserViewItem,
  canViewBorrowerFeedback,
  confirmPickup,
  daysOverdue,
  earlyPickupRefusal,
  getBorrowerFeedback,
  incomingRequestsFor,
  isOverdue,
  itemsOwnedBy,
  notifyOverdueLoans,
  sendReturnReminder,
  unreadMessageCount,
  visibleItemsFor
} from './domain';
import type { AppState } from './types';

function build(id: ScenarioId): AppState {
  const scenario = getScenario(id);
  if (!scenario) throw new Error(`missing scenario ${id}`);
  return scenario.build();
}

describe.each(scenarios.map((s) => [s.id, s] as const))('scenario %s', (_id, scenario) => {
  const state = scenario.build();
  const userIds = new Set(state.users.map((u) => u.id));
  const itemIds = new Set(state.items.map((i) => i.id));
  const requestIds = new Set(state.borrowRequests.map((r) => r.id));

  it('describes itself and acts as an existing user', () => {
    expect(scenario.title).toBeTruthy();
    expect(scenario.description).toMatch(/^You are /);
    expect(scenario.startPath.startsWith('/')).toBe(true);
    expect(state.currentUserId).toBe(scenario.actingUserId);
    expect(userIds.has(state.currentUserId)).toBe(true);
    expect(scenario.description).toContain(state.users.find((u) => u.id === state.currentUserId)!.name);
  });

  it('only references ids that exist', () => {
    const categoryIds = new Set(state.categories.map((c) => c.id));
    for (const u of state.users) {
      for (const f of [...u.friendIds, ...u.closeFriendIds]) expect(userIds.has(f)).toBe(true);
    }
    for (const i of state.items) {
      expect(userIds.has(i.lenderId)).toBe(true);
      expect(categoryIds.has(i.categoryId)).toBe(true);
      for (const a of i.allowedUserIds ?? []) expect(userIds.has(a)).toBe(true);
    }
    for (const r of state.borrowRequests) {
      expect(itemIds.has(r.itemId)).toBe(true);
      expect(userIds.has(r.borrowerId)).toBe(true);
      expect(state.items.find((i) => i.id === r.itemId)!.lenderId).toBe(r.lenderId);
      for (const m of r.messages ?? []) expect([r.borrowerId, r.lenderId]).toContain(m.fromUserId);
    }
    for (const h of state.borrowHistory) {
      expect(itemIds.has(h.itemId)).toBe(true);
      expect(userIds.has(h.borrowerId)).toBe(true);
      expect(userIds.has(h.lenderId)).toBe(true);
    }
    for (const t of state.tags) {
      expect(userIds.has(t.createdBy)).toBe(true);
      for (const i of t.itemIds) expect(itemIds.has(i)).toBe(true);
    }
    for (const n of state.notifications) {
      expect(userIds.has(n.userId)).toBe(true);
      if (n.relatedId?.startsWith('req')) expect(requestIds.has(n.relatedId)).toBe(true);
    }
    for (const f of state.friendRequests) {
      expect(userIds.has(f.fromUserId)).toBe(true);
      expect(userIds.has(f.toUserId)).toBe(true);
    }
    for (const w of state.wishlist) {
      expect(userIds.has(w.userId)).toBe(true);
      expect(itemIds.has(w.itemId)).toBe(true);
    }
  });

  it('has unique ids', () => {
    for (const list of [state.users, state.items, state.borrowRequests, state.borrowHistory, state.notifications]) {
      const ids = list.map((x) => x.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('marks an item out exactly when a loan of it is active', () => {
    for (const item of state.items) {
      const active = state.borrowRequests.some((r) => r.itemId === item.id && r.status === 'active');
      expect(item.available).toBe(!active);
    }
  });

  it('has no overlapping approved or active loans on one item', () => {
    const held = state.borrowRequests.filter((r) => r.status === 'approved' || r.status === 'active');
    for (const a of held) {
      for (const b of held) {
        if (a.id >= b.id || a.itemId !== b.itemId) continue;
        expect(rangesOverlap(a.startDate, a.endDate, b.startDate, b.endDate)).toBe(false);
      }
    }
  });

  it('gives every request its handoff lists, and every borrower sight of the item', () => {
    for (const r of state.borrowRequests) {
      expect(Array.isArray(r.pickupConfirmedBy)).toBe(true);
      expect(Array.isArray(r.returnConfirmedBy)).toBe(true);
      expect(r.startDate <= r.endDate).toBe(true);
      const item = state.items.find((i) => i.id === r.itemId)!;
      expect(canUserViewItem(item, r.borrowerId, state)).toBe(true);
    }
  });

  it('is already in the current schema and leaves the overdue sweep nothing to do', () => {
    expect(migrateState(state)).toEqual(state);
    const swept = notifyOverdueLoans(state);
    expect(swept.result).toBe(0);
    expect(swept.state).toBe(state);
  });
});

describe('what each scenario shows', () => {
  const today = todayLocalISO();

  it('overdue loan: Sarah lent something that is several days late and can send a reminder', () => {
    const state = build('overdue-loan');
    const lent = state.borrowRequests.filter((r) => r.lenderId === state.currentUserId);
    expect(lent).toHaveLength(1);
    const [loan] = lent;
    expect(isOverdue(loan, today)).toBe(true);
    expect(daysOverdue(loan, today)).toBeGreaterThanOrEqual(3);
    expect(loan.returnConfirmedBy).toEqual([]);
    expect(sendReturnReminder(state, loan.id).result).toEqual({ ok: true });
    // The automatic notices were already sent, once each.
    expect(state.notifications.filter((n) => n.relatedId === loan.id).map((n) => n.type).sort()).toEqual([
      'loan-overdue',
      'return-reminder'
    ]);
  });

  it('stranger request: a non-friend asks, sees the item through a wider tier, and their feedback is readable', () => {
    const state = build('stranger-request');
    const me = state.users.find((u) => u.id === state.currentUserId)!;
    const [request] = incomingRequestsFor(state, me.id);
    expect(request.status).toBe('pending');
    expect(request.message).toBeTruthy();
    expect(me.friendIds).not.toContain(request.borrowerId);
    expect(me.closeFriendIds).not.toContain(request.borrowerId);
    const item = state.items.find((i) => i.id === request.itemId)!;
    expect(['friends-of-friends', 'neighbors']).toContain(item.permissionLevel);

    expect(getBorrowerFeedback(request.borrowerId, state).length).toBeGreaterThan(0);
    expect(canViewBorrowerFeedback(request.borrowerId, me.id, state)).toBe(true);
    // Only because of the pending request.
    const withoutRequest = { ...state, borrowRequests: [] };
    expect(canViewBorrowerFeedback(request.borrowerId, me.id, withoutRequest)).toBe(false);
  });

  it('approved pickup: Sarah borrows from today, nobody has confirmed, and pickup is allowed', () => {
    const state = build('approved-pickup');
    const borrowing = state.borrowRequests.filter((r) => r.borrowerId === state.currentUserId);
    expect(borrowing).toHaveLength(1);
    const [loan] = borrowing;
    expect(loan.status).toBe('approved');
    expect(loan.startDate).toBe(today);
    expect(loan.pickupConfirmedBy).toEqual([]);
    expect(earlyPickupRefusal(state, loan, today)).toBeNull();
    expect(confirmPickup(state, loan.id).result).toEqual({ ok: true });
    expect(unreadMessageCount(loan, state.currentUserId)).toBe(0);
  });

  it('unread reply: the other person has a follow-up Sarah has not read; the opening note never counts', () => {
    const state = build('unread-reply');
    const [request] = state.borrowRequests;
    expect(request.borrowerId).toBe(state.currentUserId);
    expect(unreadMessageCount(request, state.currentUserId)).toBe(1);
    expect(unreadMessageCount(request, request.lenderId)).toBe(0);
    expect(request.message).toBeTruthy();
  });

  it('blank library: Casey owns and has done nothing, but Browse has things from others', () => {
    const state = build('blank-library');
    const me = state.currentUserId;
    expect(itemsOwnedBy(state, me)).toEqual([]);
    expect(state.borrowRequests.filter((r) => r.borrowerId === me || r.lenderId === me)).toEqual([]);
    expect(state.borrowHistory.filter((h) => h.borrowerId === me || h.lenderId === me)).toEqual([]);
    expect(state.tags.filter((t) => t.createdBy === me)).toEqual([]);
    expect(state.wishlist.filter((w) => w.userId === me)).toEqual([]);
    expect(state.notifications.filter((n) => n.userId === me)).toEqual([]);
    expect(state.friendRequests.filter((f) => f.fromUserId === me || f.toUserId === me)).toEqual([]);
    const user = state.users.find((u) => u.id === me)!;
    expect(user.friendIds.length).toBeLessThanOrEqual(1);
    expect(user.totalBorrows + user.totalLends).toBe(0);

    const visible = visibleItemsFor(state, me);
    expect(visible.length).toBeGreaterThanOrEqual(3);
    expect(new Set(visible.map((i) => i.lenderId)).size).toBeGreaterThanOrEqual(2);
    expect(visible.some((i) => i.permissionLevel === 'neighbors')).toBe(true);
  });

  it('builds fresh state each time', () => {
    expect(build('overdue-loan')).not.toBe(build('overdue-loan'));
    const a = build('blank-library');
    a.users[0].name = 'changed';
    expect(build('blank-library').users[0].name).not.toBe('changed');
  });
});

describe('appStore.loadScenario', () => {
  beforeEach(() => {
    appStore.reset();
    localStorage.removeItem(STORAGE_KEY);
  });

  it('replaces the state, acts as the scenario user, and saves it', () => {
    expect(appStore.loadScenario('blank-library')).toEqual({ ok: true });
    const state = get(appStore);
    expect(state.currentUserId).toBe('user7');
    expect(state.borrowRequests).toEqual([]);
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    expect(saved.currentUserId).toBe('user7');
  });

  it('refuses an unknown scenario and changes nothing', () => {
    const before = get(appStore);
    expect(appStore.loadScenario('nope').ok).toBe(false);
    expect(get(appStore)).toBe(before);
  });

  it('reset returns to the normal mock data afterwards', () => {
    appStore.loadScenario('overdue-loan');
    appStore.reset();
    expect(get(appStore)).toEqual(initialAppState);
  });
});
