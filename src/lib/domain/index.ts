/**
 * The rulebook: what each action does to the shared state and when it is
 * refused. Plain TypeScript with no framework or browser dependencies; the
 * store in `$lib/store` applies these rules and persists the result.
 *
 * One file per topic. Each file opens with a summary of the rules it holds.
 */
export * from './transition';
export * from './ids';
export * from './lists';
export * from './notifications';
export * from './permissions';
export * from './users';
export * from './items';
export * from './requests';
export * from './handoff';
export * from './overdue';
export * from './messages';
export * from './reviews';
export * from './friends';
export * from './tags';
export * from './wishlist';
