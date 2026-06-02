export const COUNTRIES = [
  "India",
  "United States",
  "United Kingdom",
  "Australia",
  "South Africa",
  "New Zealand",
  "Sri Lanka",
  "Bangladesh",
  "Pakistan",
  "Other"
] as const;

export const US_STATES = [
  "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado",
  "Connecticut", "Delaware", "Florida", "Georgia", "Hawaii", "Idaho",
  "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky", "Louisiana",
  "Maine", "Maryland", "Massachusetts", "Michigan", "Minnesota",
  "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada",
  "New Hampshire", "New Jersey", "New Mexico", "New York",
  "North Carolina", "North Dakota", "Ohio", "Oklahoma", "Oregon",
  "Pennsylvania", "Rhode Island", "South Carolina", "South Dakota",
  "Tennessee", "Texas", "Utah", "Vermont", "Virginia", "Washington",
  "West Virginia", "Wisconsin", "Wyoming"
] as const;

export const INDIA_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
  "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka",
  "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya",
  "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim",
  "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand",
  "West Bengal", "Delhi", "Jammu & Kashmir", "Ladakh", "Puducherry"
] as const;

// Dial code, expected local digit count, and a sample placeholder per country.
// "min" / "max" cover countries where length varies (e.g. NZ 8–9, UK 9–10).
export const COUNTRY_PHONE: Record<string, { dial: string; min: number; max: number; placeholder: string }> = {
  "India":         { dial: "+91",  min: 10, max: 10, placeholder: "98765 43210" },
  "United States": { dial: "+1",   min: 10, max: 10, placeholder: "555 123 4567" },
  "United Kingdom":{ dial: "+44",  min: 9,  max: 10, placeholder: "7911 123456" },
  "Australia":     { dial: "+61",  min: 9,  max: 9,  placeholder: "412 345 678" },
  "South Africa":  { dial: "+27",  min: 9,  max: 9,  placeholder: "71 234 5678" },
  "New Zealand":   { dial: "+64",  min: 8,  max: 9,  placeholder: "21 234 5678" },
  "Sri Lanka":     { dial: "+94",  min: 9,  max: 9,  placeholder: "71 234 5678" },
  "Bangladesh":    { dial: "+880", min: 10, max: 10, placeholder: "1712 345678" },
  "Pakistan":      { dial: "+92",  min: 10, max: 10, placeholder: "301 2345678" },
};

export function statesForCountry(country: string): readonly string[] | null {
  if (country === "United States") return US_STATES;
  if (country === "India") return INDIA_STATES;
  return null;
}
