/**
 * Detail pages take their id from the query string, not the path, so the app can be exported as
 * static files for the Android build: one HTML file per page, whatever the id.
 */
const withId = (path: string, id: string) => `${path}?id=${encodeURIComponent(id)}`;

export const exercisePath = (id: string) => withId("/exercises/detail", id);
export const historyPath = (id: string) => withId("/history", id);
export const summaryPath = (id: string) => withId("/workout/summary", id);
export const routineEditPath = (id: string) => withId("/routines/edit", id);
