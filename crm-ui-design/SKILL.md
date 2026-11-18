---
name: crm-ui-design
description: Design or refine CRM interfaces with clear workflows, reusable patterns, deliberate motion, and strong usability while preserving the target project's existing theme and behavior.
---

# CRM UI Design

Use this skill when creating or refining a CRM interface, including operational dashboards, billing, inventory, customer and supplier records, reports, expenses, and administrative workflows.

## Preserve the target project

- Inspect the existing app shell, routes, design tokens, shared components, typography, spacing, icon library, and responsive behavior before changing the UI.
- Preserve the target project's established visual theme. Reuse its tokens and components; do not impose another project's styling, brand, logo, or typeface.
- Keep existing navigation and page structure unless the user asks to change them.
- Keep workflows, calculations, validation, permissions, API behavior, and persisted data semantics intact unless the request explicitly changes them.
- Prefer existing primitives and shared components. Extend a shared component when that improves consistency without making its API harder to use.
- Treat supplied screenshots as visual references for the requested area. Do not copy unrelated text or controls from the reference.

## Design goals

- Make the next action obvious. Use plain labels and place controls beside the information they affect.
- Keep each page focused on its main job. Remove repeated explanations, redundant headings, and decorative elements that compete with important data.
- Establish hierarchy through spacing, typography, alignment, and restrained emphasis. Avoid excessive nested cards, borders, shadows, and oversized headings.
- Keep money, quantities, dates, status, and party names easy to scan. Align numeric values consistently and format them using the app's locale and existing conventions.
- Make related records and actions easy to find without filling the screen with every record at once. Use search, filters, selectors, and pagination where the existing data volume calls for them.
- Design desktop and narrow-screen layouts intentionally. Preserve readable controls and essential information; allow table regions to scroll horizontally when a compact table cannot reflow safely.

## Visual direction and critique

- Ground visual choices in the users, domain, and primary workflow. Use real product information and the shape of the task to guide hierarchy and layout.
- Do not default to a marketing-style hero, identical card grids, decorative labels, gradients, or a new visual identity. Operational CRM pages should prioritize work, records, and decisions.
- Avoid applying one component shape, heading treatment, or motion pattern to every section. Use structure only when it helps users understand grouping, sequence, or importance.
- Choose type roles and hierarchy deliberately while respecting the project's established typography. Do not add a second typeface or decorative treatment without a clear job.
- If a page needs a distinctive detail, choose one that helps recognition or use; keep surrounding elements calm and readable.
- Before finishing, compare the result with the request and existing app. Remove any element that is attractive but adds no clarity, function, or useful character.

## Page structure

- Use the existing application shell, header, and navigation.
- Start the content area with a concise page title and only the actions needed at page level.
- Put related filters in one compact, clearly grouped area.
- Separate the working area from supporting summaries. Keep totals and primary actions visible near the work they summarize.
- Use KPI cards for a small set of important summary values. Reserve count-up motion for prominent KPI values, not table cells or small counters.
- Keep pages visually consistent while allowing each workflow to use the layout that best fits its task.

## Forms and data entry

- Give every field a visible, persistent label. Use concise examples or helper text only when they prevent a real input mistake.
- Group fields in the order users need to complete them. Put optional fields after required fields when that makes the flow clearer, and label optionality explicitly when ambiguity could cause errors.
- Show validation beside the relevant field or in a clear form-level message. Preserve entered values when correcting an error.
- Prevent duplicate submissions: disable the primary action while saving and show an in-place progress state. Keep the user informed on success and failure.
- Reuse the project's numeric input component for amounts and quantities. Allow only the numeric formats appropriate to each field; support decimal entry only where the domain allows it.
- Preserve the domain's unit model. Show quantities and unit labels together, and do not silently convert values or change inventory calculations.
- Keep keyboard focus visible. Support logical Tab order; use arrow-key navigation for controls that are naturally navigated as a group, such as a modal form or product picker. Enter should activate the expected action without submitting prematurely from fields where that would interrupt entry.

## Tables and record lists

- Use semantic table structure with clear column labels and consistent row spacing.
- Keep columns task-focused. Avoid showing identifiers or repeated details that users do not need for the current decision.
- Align numeric columns to the right; keep names and descriptions left-aligned.
- Put row actions in a predictable final column. Use accessible labels for icon-only actions and ask for confirmation only for destructive operations where loss is meaningful.
- Keep pagination, result counts, and totals in a compact footer. Make it clear whether a total refers to the current page or the full filtered result.
- Provide useful loading, empty, filtered-empty, and error states. Empty states should explain what the user can do next without adding unnecessary copy.
- For searchable selectors inside rows, keep the menu attached to its control, searchable by relevant fields, keyboard accessible, and positioned so it is not clipped by scroll containers.

## Modals and side panels

- Use a modal for a short, focused task that should keep the user in context; use a side panel for a larger form or workflow that benefits from seeing the underlying page.
- Keep the title, close control, and primary action easy to locate. Keep the action footer visible when the form scrolls.
- Use a restrained entrance and exit transition consistent with the application. Respect reduced-motion preferences.
- Move focus into the dialog when it opens, keep keyboard focus within it, support Escape when safe, and return focus to the triggering control when it closes.
- Ensure keyboard navigation follows the visual form order. Do not make arrow keys interfere with text editing, native select behavior, or assistive technology controls.

## Interaction and motion

- Use motion to explain a state change, reveal a panel, confirm an action, or draw attention to a meaningful value. Do not animate merely to decorate.
- Keep transitions short and consistent. Prefer small opacity or position changes over large movement, bouncing, or scaling.
- Use one shared loading treatment across pages when the project already has one. Loaders should clearly indicate ongoing work and should not replace the surrounding context unnecessarily.
- Animate only prominent KPI values when appropriate. Do not animate table values, small badges, or every number in a report.
- Respect `prefers-reduced-motion` and avoid motion that delays a user's next action.

## Feedback and actions

- Give primary, secondary, and destructive actions distinct roles using the target project's existing component conventions.
- Keep primary actions singular and easy to identify within each task area.
- Use disabled states only when the action truly cannot proceed; explain the missing requirement near the control when it is not obvious.
- Show a progress label or loader during asynchronous saves, and prevent repeated clicks from creating duplicate records.
- Use concise success and error feedback. Preserve the form when a save fails so the user can correct or retry.

## Printing and exports

- Treat printable receipts and statements as documents, not screenshots of the application UI.
- Choose page dimensions for the actual output device. For thermal receipts, use a narrow page width and content-driven height rather than an A4 layout.
- Include only information needed on the printed document. Keep item names and quantities together, and show each amount once in a consistent total column.
- Keep print styling independent from application chrome and interactive controls.

## Implementation workflow

1. Inspect the relevant page, shared components, existing theme tokens, data flow, and API contracts.
2. Identify the exact requested change and the workflow invariants it must preserve.
3. Reuse existing components and implement the smallest cohesive UI change that satisfies the request.
4. Check responsive layout, keyboard behavior, loading and error states, and the requested visual details.
5. Do not add sample data, duplicate API calls, or browser storage as a substitute for existing server-backed records. Use local state only for transient UI state or an explicitly requested draft/cache behavior.
6. Do not change business rules, API payloads, or persisted data structure as a side effect of a visual redesign.
7. Report what changed and any verification performed. Do not claim visual or functional verification that was not performed.
