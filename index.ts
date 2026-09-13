// Keep the framework import explicit so Vercel selects this cloud entrypoint.
import express from 'express';
import { createApp } from './src/app.js';
import { loadConfig } from './src/config.js';

void express;
const app = createApp(loadConfig(process.env));

export default app;
