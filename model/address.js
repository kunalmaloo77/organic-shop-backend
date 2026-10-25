import mongoose from 'mongoose';

const addressSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    recipientName: { type: String },
    locality: String, // city, town, village
    administrativeArea: String, // state, province, region
    pincode: { type: String, maxLength: 15 },
    addressLine1: { type: String, maxLength: 100 },
    addressLine2: { type: String, maxLength: 100 },
    isDefault: { type: Boolean, default: false },
    geo: {
        type: {
            type: String,
            enum: ['Point'],
            required: true
        },
        coordinates: {
            type: [Number], // format: [lng, lat]
            required: true
        }
    },
    countryCode: { type: String, length: 2, default: "IN", required: true, uppercase: true }, // -- ISO 3166-1 alpha-2 (IN, US, CA, etc.)
})

export const AddressModel = mongoose.model("Address", addressSchema);