# Login Page Design Specification

This document contains the complete design specifications for the login page, including colors, typography, spacing, sizes, and all visual elements.

## Layout & Structure

### Page Wrapper (`.login-page-wrapper`)
- **Background Color**: `#ffffff` (white)
- **Min Height**: `100vh` (full viewport height)
- **Display**: Flex
- **Alignment**: Center (both horizontal and vertical)
- **Padding**: `20px` on all sides
- **Position**: Fixed (covers entire viewport)
- **Font Family**: `'Inter', Arial, Helvetica, sans-serif`

### Login Container (`.login-container`)
- **Background Color**: `#ffffff` (white)
- **Padding**: `60px 50px` (vertical: 60px, horizontal: 50px)
- **Border Radius**: `20px`
- **Box Shadow**: 
  - `0 20px 60px rgba(6, 182, 212, 0.15)` (main shadow)
  - `0 0 0 1px rgba(6, 182, 212, 0.1)` (border shadow)
- **Display**: Flex (column)
- **Alignment**: Center
- **Width**: `100%` with `max-width: 500px`
- **Position**: Relative
- **Overflow**: Hidden

### Top Accent Bar (`.login-container::before`)
- **Position**: Absolute (top: 0, full width)
- **Height**: `4px`
- **Background**: Linear gradient
  - From: `#06b6d4` (cyan-500)
  - To: `#0cc7ed` (lighter cyan)
  - Direction: `90deg` (left to right)

## Typography

### Title (`.login-title`)
- **Font Size**: `28px`
- **Font Weight**: `700` (bold)
- **Color**: `#000000` (black)
- **Margin Bottom**: `24px`
- **Text Align**: Center
- **Letter Spacing**: `-0.5px`
- **Font Family**: `'Inter', Arial, Helvetica, sans-serif`

### Input Labels (`.login-input-group label`)
- **Font Size**: `14px`
- **Font Weight**: `600` (semi-bold)
- **Color**: `#000000` (black)
- **Margin Bottom**: `8px`
- **Letter Spacing**: `0.2px`

## Form Elements

### Input Group (`.login-input-group`)
- **Width**: `100%`
- **Margin Top**: `24px`
- **Display**: Flex (column)

### Input Fields (`.login-input-group input`)
- **Width**: `100%`
- **Padding**: `16px 18px`
- **Font Size**: `15px`
- **Border**: `2px solid #e0f2fe` (light cyan border)
- **Border Radius**: `12px`
- **Background Color**: `#f8fafc` (very light gray)
- **Color**: `#0f172a` (dark slate)
- **Font Family**: `'Inter', Arial, Helvetica, sans-serif`
- **Transition**: `all 0.3s ease`

#### Input Hover State
- **Border Color**: `#bae6fd` (lighter cyan)
- **Background Color**: `#ffffff` (white)

#### Input Focus State
- **Border Color**: `#06b6d4` (cyan-500)
- **Background Color**: `#ffffff` (white)
- **Box Shadow**: `0 0 0 4px rgba(6, 182, 212, 0.1)` (cyan glow)

### Password Visibility Toggle Button
- **Position**: Absolute (inside password input)
- **Right**: `12px`
- **Top**: `50%` (centered vertically)
- **Transform**: `translateY(-50%)`
- **Background**: None
- **Border**: None
- **Cursor**: Pointer
- **Padding**: `4px`
- **Color**: `#6b7280` (gray-500)
- **Font Size**: `18px`
- **Icon Size**: `20px × 20px`

## Button

### Login Button (`.login-button`)
- **Width**: `100%`
- **Font Size**: `16px`
- **Font Weight**: `600` (semi-bold)
- **Color**: `#ffffff` (white)
- **Background**: Linear gradient
  - From: `#06b6d4` (cyan-500)
  - To: `#0cc7ed` (lighter cyan)
  - Direction: `135deg` (diagonal)
- **Border**: None
- **Border Radius**: `12px`
- **Padding**: `16px`
- **Margin Top**: `32px`
- **Cursor**: Pointer
- **Box Shadow**: `0 4px 12px rgba(6, 182, 212, 0.3)`
- **Letter Spacing**: `0.3px`
- **Font Family**: `'Inter', Arial, Helvetica, sans-serif`
- **Transition**: `all 0.3s ease`

#### Button Hover State
- **Transform**: `translateY(-2px)` (lifts up 2px)
- **Box Shadow**: `0 6px 20px rgba(6, 182, 212, 0.4)` (stronger shadow)
- **Background**: Linear gradient
  - From: `#0891b2` (darker cyan)
  - To: `#06b6d4` (cyan-500)
  - Direction: `135deg`

#### Button Active State
- **Transform**: `translateY(0)` (returns to original position)
- **Box Shadow**: `0 2px 8px rgba(6, 182, 212, 0.3)` (reduced shadow)

## Error Message

### Error Message (`.login-error-message`)
- **Color**: `#ef4444` (red-500)
- **Margin Top**: `16px`
- **Text Align**: Center
- **Font Size**: `14px`
- **Font Weight**: `500` (medium)
- **Padding**: `12px`
- **Background Color**: `#fef2f2` (very light red)
- **Border Radius**: `8px`
- **Border**: `1px solid #fecaca` (light red)
- **Width**: `100%`

## Color Palette

### Primary Colors
- **Cyan-500**: `#06b6d4` (main brand color)
- **Cyan-600**: `#0891b2` (darker variant for hover)
- **Cyan-Light**: `#0cc7ed` (lighter variant)

### Border Colors
- **Light Cyan**: `#e0f2fe` (default input border)
- **Medium Cyan**: `#bae6fd` (hover state)
- **Primary Cyan**: `#06b6d4` (focus state)

### Background Colors
- **White**: `#ffffff`
- **Light Gray**: `#f8fafc` (input background)
- **Error Background**: `#fef2f2` (error message background)

### Text Colors
- **Black**: `#000000` (titles, labels)
- **Dark Slate**: `#0f172a` (input text)
- **Gray**: `#6b7280` (icon color)
- **Red**: `#ef4444` (error text)

### Shadow Colors
- **Cyan Shadow**: `rgba(6, 182, 212, 0.15)` (container shadow)
- **Cyan Border**: `rgba(6, 182, 212, 0.1)` (container border)
- **Cyan Glow**: `rgba(6, 182, 212, 0.1)` (input focus)
- **Button Shadow**: `rgba(6, 182, 212, 0.3)` (button default)
- **Button Hover Shadow**: `rgba(6, 182, 212, 0.4)` (button hover)

## Spacing System

- **Container Padding**: `60px 50px` (vertical, horizontal)
- **Title Margin Bottom**: `24px`
- **Input Group Margin Top**: `24px`
- **Label Margin Bottom**: `8px`
- **Input Padding**: `16px 18px`
- **Button Margin Top**: `32px`
- **Button Padding**: `16px`
- **Error Margin Top**: `16px`
- **Error Padding**: `12px`
- **Page Padding**: `20px`

## Border Radius

- **Container**: `20px`
- **Input Fields**: `12px`
- **Button**: `12px`
- **Error Message**: `8px`

## Shadows

### Container Shadow
```css
box-shadow: 
  0 20px 60px rgba(6, 182, 212, 0.15),
  0 0 0 1px rgba(6, 182, 212, 0.1);
```

### Input Focus Shadow
```css
box-shadow: 0 0 0 4px rgba(6, 182, 212, 0.1);
```

### Button Shadow (Default)
```css
box-shadow: 0 4px 12px rgba(6, 182, 212, 0.3);
```

### Button Shadow (Hover)
```css
box-shadow: 0 6px 20px rgba(6, 182, 212, 0.4);
```

### Button Shadow (Active)
```css
box-shadow: 0 2px 8px rgba(6, 182, 212, 0.3);
```

## Transitions

All interactive elements use: `transition: all 0.3s ease`

## Font Specifications

- **Primary Font**: `'Inter', Arial, Helvetica, sans-serif`
- **Font Import**: Google Fonts Inter (variable font, weights 100-900)
- **Font URL**: `https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap`

## Responsive Considerations

- Container has `max-width: 500px` to prevent it from being too wide on large screens
- Page wrapper has `padding: 20px` to ensure spacing on mobile devices
- Fixed positioning ensures the login form is always centered

## Complete CSS Reference

For the complete CSS implementation, refer to:
- `src/styles/Login.css` - Main login styles
- `src/app/globals.css` - Global font and base styles

## Visual Hierarchy

1. **Top Accent Bar** - 4px cyan gradient bar at top of container
2. **Title** - 28px bold black text, centered
3. **Input Fields** - Light gray background with cyan borders
4. **Button** - Full-width cyan gradient button with shadow
5. **Error Messages** - Red text on light red background (when present)

## Accessibility Notes

- All inputs have proper labels with `htmlFor` attributes
- Password visibility toggle has `aria-label` and `title` attributes
- Error messages are clearly visible with high contrast
- Focus states are clearly defined with visible borders and shadows
- Color contrast meets WCAG standards (black text on white background)

