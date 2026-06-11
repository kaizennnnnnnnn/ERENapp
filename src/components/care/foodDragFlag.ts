// Mutable flag shared between FeedScene (writer) and CareSceneHost (reader).
// Lives in its own tiny module so CareSceneHost doesn't need a static import
// of FeedScene, which would pull the whole scene back into the layout chunk.
export const foodDrag = { active: false }
