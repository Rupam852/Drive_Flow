"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
dotenv_1.default.config({ path: path_1.default.join(__dirname, '../.env') });
const checkDB = async () => {
    try {
        await mongoose_1.default.connect(process.env.MONGO_URI);
        console.log('Connected to DB');
        const collections = await mongoose_1.default.connection.db.listCollections().toArray();
        console.log('Collections:', collections.map(c => c.name));
        const FileMetadata = mongoose_1.default.model('FileMetadata', new mongoose_1.default.Schema({}, { strict: false }));
        const count = await FileMetadata.countDocuments();
        console.log('Total FileMetadata docs:', count);
        const sample = await FileMetadata.findOne();
        console.log('Sample Doc:', JSON.stringify(sample, null, 2));
        process.exit(0);
    }
    catch (err) {
        console.error(err);
        process.exit(1);
    }
};
checkDB();
//# sourceMappingURL=debug_db.js.map