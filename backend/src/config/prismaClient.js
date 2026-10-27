import "./config.js";
import { observePrismaQuery } from '../telemetry/database.js';
import { PrismaClient } from "../generated/prisma/client.js";

const prisma = new PrismaClient({ log: [{ level: 'query', emit: 'event' }] });
prisma.$on?.('query', observePrismaQuery);

export default prisma;
