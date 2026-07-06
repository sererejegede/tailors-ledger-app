/**
 * Repository layer (client-side CRUD + the append-only history rule), built against the
 * local WatermelonDB store. No sync here — that's Phase 4. See docs/build-plan.md.
 */
export * as clients from './clients';
export * as templates from './templates';
export * as sets from './sets';
export * as items from './items';
export * as images from './images';
export * as settings from './settings';
export * as maintenance from './maintenance';
export { notDeleted, softDelete, softDeleteById } from './softDelete';
