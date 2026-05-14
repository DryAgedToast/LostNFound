# University Lost & Found App

A mobile lost-and-found application built with Expo and React Native. The app is designed to help students quickly post, browse, and claim lost or found items in one centralized place.

This project was developed as a demo for the University of Delaware, with the long-term goal of expanding to support multiple universities and potentially a public lost-and-found system.

## Project Overview

Many lost-and-found systems on campus are informal and difficult to use. At the University of Delaware, one common method for sharing lost items is through a Snapchat group. While this works for some students, it has several limitations:

   ```bash
   npx expo start
   ```
- Not every student has Snapchat
- Not every student is in the group
- Posts are difficult to search
- Items can get buried quickly
- No organized claim process
- No centralized system

This app addresses these issues by providing a structured, marketplace-style platform where users can easily post and find lost or found items.

---

## Current Demo Scope

The current version focuses on the University of Delaware to demonstrate the core concept and user flow.

The demo includes:

- Browsing lost and found items
- Viewing item details
- Displaying listings in a card-based layout
- Simulating the process of claiming or reporting items

This is not a full production system. Several features are planned but not yet fully implemented.

---

## Features

### Current Features
- Browse lost and found listings
- View item details (image, description, category)
- Card-based UI layout
- University-focused experience

### Future Features
- User authentication
- Multi-university support
- Item claiming system
- Messaging between users
- Search and filtering
- Notifications
- Admin moderation tools

---

## Tech Stack

This project uses:

- Expo
- React Native
- JavaScript / TypeScript
- Node.js
- npm

Additional libraries may be added as development continues.

---

## Getting Started

### Prerequisites

- Node.js
- npm
- Expo Go (mobile) or emulator (Android/iOS)

Check versions:
```bash
node -v
npm -v
```
---

## Installation

Clone the repository:

```bash
git clone <your-repository-url>
```

Navigate into the project folder:

```bash
cd <your-project-folder>
```

Install dependencies:

```bash
npm install
```

---

## Running the App Locally

Start the development server:

```bash
npx expo start
```

After running this command, Expo will provide options to open the app using:

- Expo Go on a physical device
- Android emulator
- iOS simulator
- Web browser, if supported

For Expo Go, scan the QR code shown in the terminal or browser window.

---

## Environment Variables

At this stage of the project, no secret environment variables are required for the basic demo.

If future versions use services such as authentication, cloud storage, databases, or APIs, environment variables should be documented here without exposing secret values.

Example format for future use:

```bash
EXPO_PUBLIC_API_URL=your_api_url_here
EXPO_PUBLIC_PROJECT_ID=your_project_id_here
```
---

## High-Level Architecture

At a high level, the app includes:

1. **Listing Feed**
   - Displays lost and found items in a card-based layout.
   - Similar in style to Facebook Marketplace.

2. **Item Details**
   - Shows more information about a selected item.
   - May include item images, title, description, location, category, and date posted.

3. **Posting Flow**
   - Allows users to create a lost or found item listing.
   - Users can upload or attach item photos and provide details.

4. **Claim Flow**
   - Intended to allow users to claim an item.
   - In the final version, this may include verification questions or messaging.

5. **University Scope**
   - The current version focuses on the University of Delaware.
   - Future versions may support multiple universities and public communities.

---

## Folder and File Overview

The exact structure may change as the project develops, but the project may include folders similar to the following:

```txt
project-root/
│
├── app/                  # Main app screens and routes
├── assets/               # Images, icons, fonts, and other static assets
├── components/           # Reusable UI components
├── constants/            # Shared colors, styles, and app constants
├── hooks/                # Custom React hooks
├── scripts/              # Utility scripts
├── package.json          # Project dependencies and npm scripts
├── app.json              # Expo configuration
└── README.md             # Project documentation
```

### Important Files

- `package.json`
  - Lists project dependencies and scripts.

- `app.json`
  - Contains Expo app configuration.

- `app/`
  - Contains the main screens and routing structure.

- `components/`
  - Contains reusable interface elements such as item cards, buttons, headers, and layout components.

- `assets/`
  - Stores images and other static files used in the app.

---

## Known Bugs, Limitations, and Incomplete Features

This project is still in development. The following limitations are currently known:

- The app is currently focused only on the University of Delaware for demo purposes.
- Multi-university support has not been fully implemented yet.
- Public lost-and-found support is a future goal, not part of the current demo.
- User authentication may not be fully implemented.
- Item claiming may be limited or simulated in the demo.
- Messaging between users may not be fully implemented.
- Admin moderation tools may not be available yet.
- Search and filtering may be basic or incomplete.
- Data may be local, mocked, or not connected to a production database yet.
- Security and privacy features would need to be expanded before a public release.

These limitations are expected for the current version because the demo is meant to communicate the concept and core user experience rather than serve as a complete production application.

---

## Future Work

Future development could include:

- Expanding beyond the University of Delaware
- Supporting multiple universities
- Allowing users to choose their school or community
- Adding public lost-and-found listings outside of universities
- Implementing secure user authentication
- Adding a real backend database
- Adding cloud image storage
- Creating a verified claim process
- Adding direct messaging between users
- Adding push notifications
- Improving search, filters, and sorting
- Adding admin controls for inappropriate or duplicate listings
- Creating a web version of the app
- Improving accessibility and mobile responsiveness
- Adding analytics to understand lost-item trends on campus
- Making it user-friendly for mobile devices as well

---

## Deployment

This project is currently designed to run locally through Expo.

For a future production release, deployment options could include:

- Expo Application Services, also known as EAS
- App Store deployment for iOS
- Google Play Store deployment for Android
- A backend hosting platform if server-side features are added

Deployment instructions should be updated once the app is ready for production or public testing.

---

## Code Quality and Organization

 - Consistent naming conventions
 - Reusable components
 - Clean and organized structure
 - Minimal unused code
 - Comments added where needed

---

## Code Style

- Use functional React components
- Use TypeScript where possible
- Follow consistent naming:
  - camelCase for variables
  - PascalCase for components
- Keep components small and reusable
---

## User Guide 

- Open the app
- Browse listings on home screen
- Tap item to view details
- Future versions: claim or post items

---

## Contributors

Add team members here:

```txt
Bryan Cabrera Icte - Developer
Suvil Kaushik - Developer
Marc Madlangbayan - Developer
Ujjwala Pothula - Developer
Joshua Washington - Developer

To contribute:
1. Fork the repo
2. Create a new branch (feature/your-feature-name)
3. Commit changes
4. Push and open a pull request

Please follow consistent naming and formatting conventions.
```
---

## Project Status

This project is currently in demo development.

The current goal is to demonstrate the core concept of a centralized, marketplace-style lost-and-found app for a university environment. The final vision is a larger platform that could support many universities and potentially the general public.
