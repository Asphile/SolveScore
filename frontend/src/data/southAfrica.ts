// South African provinces and their district/metropolitan municipalities.
// Used to power cascading dropdowns instead of free-text entry.
export const SA_PROVINCES = [
  "Eastern Cape",
  "Free State",
  "Gauteng",
  "KwaZulu-Natal",
  "Limpopo",
  "Mpumalanga",
  "North West",
  "Northern Cape",
  "Western Cape",
] as const;

export const SA_DISTRICTS_BY_PROVINCE: Record<string, string[]> = {
  "Eastern Cape": [
    "Buffalo City Metro",
    "Nelson Mandela Bay Metro",
    "Alfred Nzo",
    "Amathole",
    "Chris Hani",
    "Joe Gqabi",
    "OR Tambo",
    "Sarah Baartman",
  ],
  "Free State": ["Mangaung Metro", "Fezile Dabi", "Lejweleputswa", "Thabo Mofutsanyana", "Xhariep"],
  Gauteng: [
    "City of Johannesburg Metro",
    "City of Tshwane Metro",
    "Ekurhuleni Metro",
    "Sedibeng",
    "West Rand",
  ],
  "KwaZulu-Natal": [
    "eThekwini Metro",
    "Amajuba",
    "Harry Gwala",
    "iLembe",
    "King Cetshwayo",
    "Ugu",
    "uMgungundlovu",
    "uMkhanyakude",
    "uMzinyathi",
    "uThukela",
    "Zululand",
  ],
  Limpopo: ["Capricorn", "Mopani", "Sekhukhune", "Vhembe", "Waterberg"],
  Mpumalanga: ["Ehlanzeni", "Gert Sibande", "Nkangala"],
  "North West": [
    "Bojanala Platinum",
    "Dr Kenneth Kaunda",
    "Dr Ruth Segomotsi Mompati",
    "Ngaka Modiri Molema",
  ],
  "Northern Cape": [
    "Frances Baard",
    "John Taolo Gaetsewe",
    "Namakwa",
    "Pixley ka Seme",
    "ZF Mgcawu",
  ],
  "Western Cape": [
    "City of Cape Town Metro",
    "Cape Winelands",
    "Central Karoo",
    "Garden Route",
    "Overberg",
    "West Coast",
  ],
};

export const OTHER_OPTION = "Other (specify)";
