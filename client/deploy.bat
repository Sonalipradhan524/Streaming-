@echo off
rem Build the Vite project
npm run build

rem Deploy to Firebase Hosting
firebase deploy --only hosting
