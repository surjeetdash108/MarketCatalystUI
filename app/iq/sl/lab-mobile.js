/**
 * Strategy Lab on a phone (≤640px). The Lab's markup is inline-styled for the
 * desktop grid, so these rules override it (hence !important) through class
 * hooks on the few elements that need a different layout:
 *
 *  - results table → one card per stock: logo, ticker and price on top, the
 *    four numbers below, each labelled with its column name (data-l), since the
 *    header row is hidden;
 *  - strategy library → the list stacks above the selected strategy (it was a
 *    220px side column that pushed the strategy off the screen);
 *  - page, strategy box, results box and pop-up padding shrink;
 *  - the pop-up's close button sits in its top-right corner and its
 *    seven-column trade list scrolls sideways.
 */
export const LAB_MOBILE_CSS =
  "@media (max-width:640px){" +
  ".sl-pad{padding:12px 12px 32px !important}" +
  ".sl-box{padding:16px 14px !important;gap:16px !important}" +
  ".sl-box-title{font-size:24px !important}" +
  ".sl-res-box{padding:14px 12px !important}" +
  ".sl-res-hdr{display:none !important}" +
  ".sl-res-list{max-height:560px !important}" +
  // Win % is short and "41 + 1 open" is long: the last column gets the room.
  ".sl-res-row{grid-template-columns:minmax(0,1fr) minmax(0,1fr) minmax(0,.7fr) minmax(0,1.2fr) !important;gap:10px 6px !important;align-items:start !important;padding:12px 6px !important}" +
  ".sl-res-stock{grid-column:1 / 4}" +
  ".sl-res-px{grid-column:4}" +
  ".sl-res-stat{text-align:left !important;white-space:nowrap;font-size:11.5px !important}" +
  ".sl-res-stat::before{content:attr(data-l);display:block;font-family:Manrope,system-ui,sans-serif;font-size:9px;font-weight:700;letter-spacing:.06em;color:#5f6966;margin-bottom:3px}" +
  ".sl-lib-grid{grid-template-columns:minmax(0,1fr) !important}" +
  ".sl-lib-side{position:static !important}" +
  ".sl-lib-list{max-height:300px !important}" +
  ".sl-modal{position:relative;padding:16px 14px !important}" +
  ".sl-modal-x{position:absolute;top:12px;right:12px}" +
  ".sl-modal-head{padding-right:40px}" +
  ".sl-trades{overflow-x:auto !important}" +
  ".sl-trades>div{min-width:560px}" +
  "}";
