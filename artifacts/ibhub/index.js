// Custom app entry point.
//
// We import a tiny, dependency-light diagnostics prelude BEFORE expo-router's
// entry. Because ES module imports are evaluated top-to-bottom, this guarantees
// the global JS error handler (and the iOS boot sentinel) are installed BEFORE
// the app's own module graph (i18n, AuthContext, contexts, screens, native
// module side effects…) is evaluated by `expo-router/entry`. That lets us catch
// and surface boot-time failures that the app's own handler — which only runs
// after all of _layout's imports have already evaluated — would miss.
import "./boot-diagnostics";
import "expo-router/entry";
