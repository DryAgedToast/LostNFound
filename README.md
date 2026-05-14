# Welcome to your Expo app 👋
# University Lost & Found App

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).
A mobile lost-and-found application built with Expo and React Native. The app is designed to help students quickly post, browse, and claim lost or found items in one centralized place.

## Get started
This project was created as a university-focused demo for the University of Delaware. The long-term goal is to expand the platform beyond one campus and eventually support multiple universities or even a public lost-and-found system.

1. Install dependencies
---

   ```bash
   npm install
   ```
## Project Overview

2. Start the app
Many lost-and-found systems on campus are informal and difficult to use. At the University of Delaware, one common method for sharing lost items is through a Snapchat group. While this works for some students, it has several problems:

   ```bash
   npx expo start
   ```
- Not every student has Snapchat
- Not every student is in the group
- Posts are difficult to search through
- Items can get buried quickly
- There is no organized claim process
- There is no centralized system for lost and found items

In the output, you'll find options to open the app in a
This app aims to solve that problem by creating a marketplace-style lost-and-found platform. The structure is inspired by apps like Facebook Marketplace, where users can browse item cards, view photos, filter by category, and interact with listings.

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo
Instead of buying and selling items, users can post lost or found belongings and help return them to the correct owner.

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).
---

## Current Demo Scope

When you're ready, run:
For the current demo, the app is focused locally on the University of Delaware. This allows us to keep the project manageable while demonstrating the core idea and user flow.

The demo version is intended to show:

- How users can browse lost and found items
- How item listings can be displayed in a marketplace-style layout
- How users can view item details
- How users could eventually claim or report an item
- How the app could replace informal systems like Snapchat groups

The current version is not intended to be the final production version. Some larger-scale features are explained as future work rather than fully implemented in the demo.

---

## Features

### Current or Planned Demo Features

- Browse lost and found item listings
- View item images, titles, categories, and descriptions
- Display items in a clean card-based layout
- Support a University of Delaware-focused lost-and-found experience
- Provide a foundation for future item claiming and user interaction features

### Future Full-Version Features

- User accounts and authentication
- University-specific communities
- Ability to select or join a university
- Item claiming process
- Direct messaging between finder and owner
- Admin moderation for reports and claims
- Search and filtering by category, date, location, and item type
- Notifications when similar items are posted
- Expansion to multiple universities
- Potential public lost-and-found support outside of universities

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

Follow these instructions to run the project locally.

### Prerequisites

Make sure you have the following installed:

- Node.js
- npm
- Expo Go app on your mobile device, or an Android/iOS simulator

You can check your Node and npm versions with:

```bash
npm run reset-project
node -v
npm -v
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.
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

### Other setup steps
Do not commit real secret keys, API tokens, or passwords to the repository.

- To set up ESLint for linting, run `npx expo lint`, or follow our guide on ["Using ESLint and Prettier"](https://docs.expo.dev/guides/using-eslint/)
- If you'd like to set up unit testing, follow our guide on ["Unit Testing with Jest"](https://docs.expo.dev/develop/unit-testing/)
- Learn more about the TypeScript setup in this template in our guide on ["Using TypeScript"](https://docs.expo.dev/guides/typescript/)
---

## High-Level Architecture

To learn more about developing your project with Expo, look at the following resources:
The app is structured as a mobile lost-and-found platform.

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

The project should be kept clean and organized so that a future developer, teammate, or stakeholder can understand the work without needing the original developers to explain every file.

General code expectations:

- Use clear and consistent file names
- Keep reusable UI elements in component files
- Add comments where logic may not be obvious
- Avoid leaving unused files or unused imports
- Keep formatting consistent
- Do not commit secret keys or private credentials
- Keep the README updated as the project changes

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
