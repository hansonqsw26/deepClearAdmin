import { NAVTOGGLE } from '../actions/AuthActions';

/** true while the sidebar is collapsed. */
export function sideMenu(state = false, action) {
    return action.type === NAVTOGGLE ? !state : state;
}
