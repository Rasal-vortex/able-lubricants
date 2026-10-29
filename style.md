# General UI Style Guide

Use this guide to keep an application’s interface consistent. Follow the visual theme already established by the specific website, product, or design reference. Do not impose a palette, style, or component pattern from an unrelated project.

This guide covers the application UI and reusable interface patterns. It does not cover login or sign-up screens.

## Follow the existing theme

- Inspect the project’s UI, design reference, shared components, and design tokens before making visual changes.
- Reuse the project’s existing colors, typography, shapes, surfaces, borders, shadows, and interaction styles.
- Keep the same theme across every screen and component. Do not invent new colors or mix unrelated design references.
- Use existing theme tokens when available. If a needed style is missing, derive it from the established design and define it centrally for reuse.
- Maintain readable contrast and use visual emphasis consistently.

## Visual hierarchy

- Make the most important content easy to find at a glance.
- Use clear differences between page titles, section headings, body text, labels, and supporting details.
- Keep related information grouped and arrange content in a predictable reading order.
- Use emphasis sparingly so important actions and values stand out.

## Layout and spacing

- Follow the application’s established page structure and navigation pattern.
- Use consistent alignment, spacing, and content widths across screens.
- Group related controls and content; leave enough room to distinguish separate sections.
- Avoid cramped layouts, excessive empty space, and decorative elements that compete with the content.
- Keep repeated components aligned and consistent in size.

## Reusable components

- Reuse shared components for navigation, cards, buttons, fields, dialogs, badges, tables, and feedback states.
- Keep component appearance and behavior consistent wherever a component is reused.
- Use icons that match the existing icon style. Give icon-only controls accessible names.
- Prefer simple, purposeful decoration. Add illustrations, gradients, or large decorative icons only when they fit the project’s established theme and improve understanding.

## Data and content components

- Make cards concise, scannable, and appropriate to the amount of content they contain.
- Keep tables readable with clear labels, consistent alignment, and predictable row actions.
- Do not show internal or technical identifiers unless the user needs them for a real task.
- Use empty states that explain what is missing and offer a relevant action when one is available.
- Do not fabricate data, trends, or content to fill unused space.

## Forms and actions

- Keep field labels, sizes, spacing, borders, and focus states consistent with the project’s existing controls.
- Make required fields and validation messages clear.
- Preserve entered values when an error can be corrected and retried.
- Make button styles communicate their importance consistently, including primary, secondary, and destructive actions.
- Ensure every visible control works as its label implies.

## Interaction states

- Design consistent hover, focus, active, selected, disabled, loading, success, and error states.
- Keep feedback clear and close to the action or content it relates to.
- Preserve layout during loading with an appropriate skeleton or indicator.
- Keep motion subtle and respect reduced-motion settings.

## Responsive behavior

- Adapt layouts to the available screen size while retaining the same visual identity.
- Reflow grids and content instead of squeezing them into unreadable widths.
- Keep navigation, forms, tables, dialogs, and actions usable on touch screens.
- Prevent accidental page overflow. If wide content needs scrolling, contain it within that component.

## Accessibility

- Use semantic structure and controls.
- Support keyboard navigation and provide visible focus states.
- Provide accessible labels for inputs and names for icon-only controls.
- Maintain readable text and contrast.
- Do not communicate meaning through color alone.

## Before finishing a screen

- Does it follow the project’s existing theme and design reference?
- Are spacing, typography, alignment, and component styles consistent with other screens?
- Is the most important content easy to scan?
- Do all controls have clear labels and working behavior?
- Are loading, empty, error, and success states covered where needed?
- Does the interface remain usable at different screen sizes and with a keyboard?
