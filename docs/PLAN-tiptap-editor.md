# PLAN: Tiptap Rich Text Editor Implementation

This plan outlines the steps to integrate a Tiptap-based Rich Text Editor (RTE) into the feature description field, storing content as JSON for better security and flexibility.

## User Review Required

> [!IMPORTANT]
> The editor will be strictly limited to: **Bold, Italic, Bulleted List, Numbered List, Link, and Code**. This ensures a clean and consistent design across feature descriptions.

> [!NOTE]
> We will implement conditional rendering to support both new JSON-based descriptions and existing legacy plain-text descriptions.

## Proposed Changes

### [Admin Dashboard]

#### [NEW] [RichTextEditor.jsx](file:///h:/dev/gu_roadmap/client/src/components/RichTextEditor.jsx)
- A reusable Tiptap editor component.
- Custom toolbar with Lucide icons for the allowed features.
- Handles content as JSON.

#### [MODIFY] [AdminFeatureFormPage.jsx](file:///h:/dev/gu_roadmap/client/src/pages/admin/AdminFeatureFormPage/AdminFeatureFormPage.jsx)
- Replace the standard `textarea` with the new `RichTextEditor` component for the description field.
- Ensure the `formData` correctly handles the JSON object from Tiptap.

### [Public Roadmap]

#### [NEW] [RichTextViewer.jsx](file:///h:/dev/gu_roadmap/client/src/components/RichTextViewer.jsx)
- A component to safely render description content.
- **Logic**: 
  - Attempt to parse content as JSON.
  - If valid JSON: Use Tiptap's `generateHTML` with the same limited extensions to render it.
  - If invalid JSON (legacy): Render as plain text with basic line-break support.

#### [MODIFY] [FeatureCard.jsx](file:///h:/dev/gu_roadmap/client/src/components/FeatureCard.jsx)
- Update the description rendering to use `RichTextViewer`.
- For the card view, we will likely only show a plain-text preview (stripping tags) to maintain the layout.

#### [MODIFY] [FeatureDetailModal.jsx](file:///h:/dev/gu_roadmap/client/src/components/FeatureDetailModal.jsx)
- Update the detailed description section to use `RichTextViewer` for full rich-text rendering.

## Open Questions

- No remaining open questions based on the previous Socratic Gate.

## Verification Plan

### Automated Tests
- N/A (Manual verification via browser tool)

### Manual Verification
1. **Admin Form**: Verify the Tiptap editor renders with the correct toolbar icons.
2. **Persistence**: Create a feature with rich text and verify it saves correctly to the database as a JSON string.
3. **Public View**: Verify the feature renders with correct formatting (bold, lists, etc.) in the `FeatureDetailModal`.
4. **Legacy Support**: Check an existing feature (plain text) to ensure it still renders correctly without breaking.
5. **Security**: Verify that any injected HTML tags in the JSON structure are not rendered unless they are part of the allowed Tiptap extension set.
