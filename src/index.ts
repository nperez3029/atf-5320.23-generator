import * as mupdf from "mupdf";

// Special symbol to represent selected checkboxes/radio buttons
const SELECTED = Symbol("SELECTED");

// Type declarations for global functions
declare global {
  interface Window {
    generatePDF: () => Promise<void>;
    serializeForm: () => NFAFormData;
  }
}

// Form data interface matching the HTML form structure
interface NFAFormData {
  // Question 1
  q1_formType?: string;

  // Question 2
  q2_fullName?: string;
  q2_address?: string;

  // Question 3
  q3a_fullName?: string;
  q3a_homeAddress?: string;
  q3a_sameAs2?: boolean;
  q3b_telephone?: string;
  q3c_email?: string;
  q3d_otherNames?: string;
  q3f_ssn?: string;
  q3g_dob?: string;
  q3h_ethnicity?: string;
  q3i_race?: string;

  // Question 4
  q4a_firearmType?: string;
  q4a_firearmType_other?: string;
  q4b_name?: string;
  q4b_address?: string;
  q4c_model?: string;
  q4d_caliber?: string;
  q4e_serial?: string;

  // Question 5
  q5_agencyName?: string;
  q5_officialName?: string;
  q5_officialTitle?: string;
  q5_address?: string;

  // Question 6 (prohibitors)
  q6a_intent?: string;
  q6b_sell?: string;
  q6c_indictment?: string;
  q6d_convicted?: string;
  q6e_fugitive?: string;
  q6f_user?: string;
  q6g_mental?: string;
  q6h_dishonorable?: string;
  q6i_restraining?: string;
  q6j_domestic?: string;
  q6k_renounced?: string;
  q6l_illegal?: string;
  q6m1_nonimmigrant?: string;
  q6m2_exception?: string;

  // Question 7
  q7_alienNumber?: string;

  // Question 8
  q8_hasUpin?: string;
  q8_upinNumber?: string;

  // Question 9
  q9a_citizenship?: string[] | string;
  q9a_citizenship_other?: string;
  q9b_birthState?: string;
  q9c_birthCountry?: string;
  q9c_birthCountry_other?: string;

  // Certification
  certificationDate?: string;
}

// Function to get form data from HTML form
function getFormData(): NFAFormData {
  // Use the existing serializeForm function from the HTML page
  if (typeof window.serializeForm === "function") {
    return window.serializeForm();
  }

  // Fallback: basic form data extraction
  const form = document.getElementById("nfa-form") as HTMLFormElement;
  if (!form) {
    throw new Error("Form not found");
  }

  const formData = new FormData(form);
  const data: NFAFormData = {};

  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") {
      (data as any)[key] = value.toUpperCase();
    }
  }

  return data;
}

// Helper function to ensure strings are uppercase
function normalizeString(value: string | undefined): string | undefined {
  return value ? value.toUpperCase() : value;
}

// Helper function to parse date strings as local dates to avoid timezone issues
function parseLocalDate(dateString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day); // month is 0-indexed
}

// Function to map form data to PDF widget format
function mapFormDataToPdfFields(
  formData: NFAFormData,
): Map<string, string | typeof SELECTED> {
  const fieldsToFill = new Map<string, string | typeof SELECTED>();

  // Question 1 - Form Type
  if (formData.q1_formType) {
    const formTypeMapping: Record<string, string> = {
      "ATF FORM 1": "topmostSubform[0].Page1[0].form1[0]",
      "ATF FORM 4": "topmostSubform[0].Page1[0].form4[0]",
      "ATF FORM 5": "topmostSubform[0].Page1[0].form5[0]",
    };
    const widgetName = formTypeMapping[formData.q1_formType];
    if (widgetName) {
      fieldsToFill.set(widgetName, SELECTED);
    }
  }

  // Question 2 - Applicant/Transferee
  if (formData.q2_fullName || formData.q2_address) {
    const applicantInfo = [
      normalizeString(formData.q2_fullName) || "",
      normalizeString(formData.q2_address) || "",
    ]
      .filter((x) => x)
      .join("\n");

    if (applicantInfo) {
      fieldsToFill.set(
        "topmostSubform[0].Page1[0].applicantaddress[0]",
        applicantInfo,
      );
    }
  }

  // Question 3a - Responsible Person
  if (formData.q3a_fullName || formData.q3a_homeAddress || formData.q3a_sameAs2) {
    let homeAddress = normalizeString(formData.q3a_homeAddress) || "";
    
    // If "SAME AS 2" is checked and address field is empty, use address from Question 2
    if (formData.q3a_sameAs2 && !homeAddress && formData.q2_address) {
      homeAddress = normalizeString(formData.q2_address) || "";
    }
    
    const responsibleInfo = [
      normalizeString(formData.q3a_fullName) || "",
      homeAddress,
    ]
      .filter((x) => x)
      .join("\n");

    if (responsibleInfo) {
      fieldsToFill.set(
        "topmostSubform[0].Page1[0].responsibleaddress[0]",
        responsibleInfo,
      );
    }
  }

  // Question 3b - Telephone
  if (formData.q3b_telephone) {
    fieldsToFill.set(
      "topmostSubform[0].Page1[0].telephone[0]",
      normalizeString(formData.q3b_telephone)!,
    );
  }

  // Question 3c - Email
  if (formData.q3c_email) {
    fieldsToFill.set(
      "topmostSubform[0].Page1[0].email[0]",
      normalizeString(formData.q3c_email)!,
    );
  }

  // Question 3d - Other Names
  if (formData.q3d_otherNames) {
    fieldsToFill.set(
      "topmostSubform[0].Page1[0].othernames[0]",
      normalizeString(formData.q3d_otherNames)!,
    );
  }

  // Question 3f - SSN
  if (formData.q3f_ssn) {
    fieldsToFill.set(
      "topmostSubform[0].Page1[0].ssn2f[0]",
      normalizeString(formData.q3f_ssn)!,
    );
  }

  // Question 3g - Date of Birth
  if (formData.q3g_dob) {
    const date = parseLocalDate(formData.q3g_dob);
    const formattedDate = `${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}/${date.getFullYear()}`;
    fieldsToFill.set("topmostSubform[0].Page1[0].#field[24]", formattedDate);
  }

  // Question 3h - Ethnicity
  if (formData.q3h_ethnicity) {
    const ethnicityMapping: Record<string, string> = {
      "HISPANIC OR LATINO": "topmostSubform[0].Page1[0].ehl[0]",
      "NOT HISPANIC OR LATINO": "topmostSubform[0].Page1[0].nhl[0]",
    };
    const widgetName = ethnicityMapping[formData.q3h_ethnicity];
    if (widgetName) {
      fieldsToFill.set(widgetName, SELECTED);
    }
  }

  // Question 3i - Race
  if (formData.q3i_race) {
    const raceMapping: Record<string, string> = {
      "AMERICAN INDIAN OR ALASKA NATIVE": "topmostSubform[0].Page1[0].aian[0]",
      ASIAN: "topmostSubform[0].Page1[0].a[0]",
      "BLACK OR AFRICAN AMERICAN": "topmostSubform[0].Page1[0].baa[0]",
      "NATIVE HAWAIIAN OR OTHER PACIFIC ISLANDER":
        "topmostSubform[0].Page1[0].nhopi[0]",
      WHITE: "topmostSubform[0].Page1[0].w[0]",
    };
    const widgetName = raceMapping[formData.q3i_race];
    if (widgetName) {
      fieldsToFill.set(widgetName, SELECTED);
    }
  }

  // Question 4a - Firearm Type
  if (formData.q4a_firearmType) {
    let firearmType = normalizeString(formData.q4a_firearmType);
    if (firearmType === "OTHER" && formData.q4a_firearmType_other) {
      firearmType = normalizeString(formData.q4a_firearmType_other);
    }
    if (firearmType) {
      fieldsToFill.set(
        "topmostSubform[0].Page1[0].firearmtype[0]",
        firearmType,
      );
    }
  }

  // Question 4b - Maker/Manufacturer
  if (formData.q4b_name || formData.q4b_address) {
    const makerInfo = [
      normalizeString(formData.q4b_name) || "",
      normalizeString(formData.q4b_address) || "",
    ]
      .filter((x) => x)
      .join("\n");

    if (makerInfo) {
      fieldsToFill.set(
        "topmostSubform[0].Page1[0].importeraddress[0]",
        makerInfo,
      );
    }
  }

  // Question 4c - Model
  if (formData.q4c_model) {
    fieldsToFill.set(
      "topmostSubform[0].Page1[0].Model[0]",
      normalizeString(formData.q4c_model)!,
    );
  }

  // Question 4d - Caliber
  if (formData.q4d_caliber) {
    fieldsToFill.set(
      "topmostSubform[0].Page1[0].caliber[0]",
      normalizeString(formData.q4d_caliber)!,
    );
  }

  // Question 4e - Serial Number
  if (formData.q4e_serial) {
    fieldsToFill.set(
      "topmostSubform[0].Page1[0].serial[0]",
      normalizeString(formData.q4e_serial)!,
    );
  }

  // Question 5 - Law Enforcement
  const leoInfo = [
    normalizeString(formData.q5_agencyName) || "",
    formData.q5_officialName
      ? `${normalizeString(formData.q5_officialName)}${formData.q5_officialTitle ? ", " + normalizeString(formData.q5_officialTitle) : ""}`
      : "",
    normalizeString(formData.q5_address) || "",
  ].filter((x) => x);

  if (leoInfo.length > 0) {
    fieldsToFill.set(
      "topmostSubform[0].Page1[0].TextField3[0]",
      leoInfo[0] || "",
    );
    if (leoInfo[1])
      fieldsToFill.set("topmostSubform[0].Page1[0].TextField4[0]", leoInfo[1]);
    if (leoInfo[2])
      fieldsToFill.set("topmostSubform[0].Page1[0].TextField5[0]", leoInfo[2]);
  }

  // Question 6 - Prohibitors
  const prohibitorMapping: Record<string, [string, string]> = {
    q6a_intent: [
      "topmostSubform[0].Page2[0].CheckBoxYes6a[0]",
      "topmostSubform[0].Page2[0].CheckBoxno6a[0]",
    ],
    q6b_sell: [
      "topmostSubform[0].Page2[0].CheckBoxYes6b[0]",
      "topmostSubform[0].Page2[0].CheckBoxno6b[0]",
    ],
    q6c_indictment: [
      "topmostSubform[0].Page2[0].CheckBoxYes1[0]",
      "topmostSubform[0].Page2[0].CheckBoxno1[0]",
    ],
    q6d_convicted: [
      "topmostSubform[0].Page2[0].CheckBoxYes2[0]",
      "topmostSubform[0].Page2[0].CheckBoxno2[0]",
    ],
    q6e_fugitive: [
      "topmostSubform[0].Page2[0].CheckBoxYes3[0]",
      "topmostSubform[0].Page2[0].CheckBoxno3[0]",
    ],
    q6f_user: [
      "topmostSubform[0].Page2[0].CheckBoxYes4[0]",
      "topmostSubform[0].Page2[0].CheckBoxno4[0]",
    ],
    q6g_mental: [
      "topmostSubform[0].Page2[0].CheckBoxYes5[0]",
      "topmostSubform[0].Page2[0].CheckBoxno5[0]",
    ],
    q6h_dishonorable: [
      "topmostSubform[0].Page2[0].CheckBoxYes6[0]",
      "topmostSubform[0].Page2[0].CheckBoxno6[0]",
    ],
    q6i_restraining: [
      "topmostSubform[0].Page2[0].CheckBoxYes7[0]",
      "topmostSubform[0].Page2[0].CheckBoxno7[0]",
    ],
    q6j_domestic: [
      "topmostSubform[0].Page2[0].CheckBoxYes8[0]",
      "topmostSubform[0].Page2[0].CheckBoxno8[0]",
    ],
    q6k_renounced: [
      "topmostSubform[0].Page2[0].CheckBoxYes9[0]",
      "topmostSubform[0].Page2[0].CheckBoxno9[0]",
    ],
    q6l_illegal: [
      "topmostSubform[0].Page2[0].CheckBoxYes10[0]",
      "topmostSubform[0].Page2[0].CheckBoxno10[0]",
    ],
    q6m1_nonimmigrant: [
      "topmostSubform[0].Page2[0].CheckBoxYes11[0]",
      "topmostSubform[0].Page2[0].CheckBoxno11[0]",
    ],
  };

  for (const [formField, [yesWidget, noWidget]] of Object.entries(
    prohibitorMapping,
  )) {
    const value = formData[formField as keyof NFAFormData];
    if (value === "YES") {
      fieldsToFill.set(yesWidget, SELECTED);
    } else if (value === "NO") {
      fieldsToFill.set(noWidget, SELECTED);
    }
  }

  // Question 6m2 - Special handling for N/A option
  if (formData.q6m2_exception) {
    if (formData.q6m2_exception === "N/A") {
      fieldsToFill.set("topmostSubform[0].Page2[0].CheckBoxNA[0]", SELECTED);
    } else if (formData.q6m2_exception === "YES") {
      fieldsToFill.set("topmostSubform[0].Page2[0].CheckBoxYes12[0]", SELECTED);
    } else if (formData.q6m2_exception === "NO") {
      fieldsToFill.set("topmostSubform[0].Page2[0].CheckBoxno12[0]", SELECTED);
    }
  }

  // Question 7 - Alien Number
  if (formData.q7_alienNumber) {
    fieldsToFill.set(
      "topmostSubform[0].Page2[0].TextFieldalien[0]",
      normalizeString(formData.q7_alienNumber)!,
    );
  }

  // Question 8 - UPIN
  if (formData.q8_hasUpin) {
    if (formData.q8_hasUpin === "YES") {
      fieldsToFill.set("topmostSubform[0].Page2[0].yes17[0]", SELECTED);
      if (formData.q8_upinNumber) {
        fieldsToFill.set(
          "topmostSubform[0].Page2[0].please17[0]",
          normalizeString(formData.q8_upinNumber)!,
        );
      }
    } else if (formData.q8_hasUpin === "NO") {
      fieldsToFill.set("topmostSubform[0].Page2[0].no17[0]", SELECTED);
    }
  }

  // Question 9a - Citizenship
  if (formData.q9a_citizenship) {
    const citizenship = Array.isArray(formData.q9a_citizenship)
      ? formData.q9a_citizenship
      : [formData.q9a_citizenship];
    if (citizenship.includes("USA")) {
      fieldsToFill.set("topmostSubform[0].Page2[0].usacheckbox[0]", SELECTED);
    }
    if (citizenship.includes("OTHER") && formData.q9a_citizenship_other) {
      fieldsToFill.set(
        "topmostSubform[0].Page2[0].othercountrycheckbox[0]",
        SELECTED,
      );
      fieldsToFill.set(
        "topmostSubform[0].Page2[0].Othercountry[0]",
        normalizeString(formData.q9a_citizenship_other)!,
      );
    }
  }

  // Question 9b - State of Birth
  if (formData.q9b_birthState) {
    fieldsToFill.set(
      "topmostSubform[0].Page2[0].statebirth[0]",
      normalizeString(formData.q9b_birthState)!,
    );
  }

  // Question 9c - Country of Birth
  if (formData.q9c_birthCountry) {
    if (formData.q9c_birthCountry === "USA") {
      fieldsToFill.set(
        "topmostSubform[0].Page2[0].statecountry[0]",
        "UNITED STATES OF AMERICA",
      );
    } else if (
      formData.q9c_birthCountry === "OTHER" &&
      formData.q9c_birthCountry_other
    ) {
      fieldsToFill.set(
        "topmostSubform[0].Page2[0].statecountry[0]",
        normalizeString(formData.q9c_birthCountry_other)!,
      );
    }
  }

  // Certification Date
  if (formData.certificationDate) {
    const date = parseLocalDate(formData.certificationDate);
    const formattedDate = `${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}/${date.getFullYear()}`;
    fieldsToFill.set("topmostSubform[0].Page2[0].DateField9[0]", formattedDate);
  } else {
    // Default to today's date
    const currentDate = new Date();
    const formattedDate = `${String(currentDate.getMonth() + 1).padStart(2, "0")}/${String(currentDate.getDate()).padStart(2, "0")}/${currentDate.getFullYear()}`;
    fieldsToFill.set("topmostSubform[0].Page2[0].DateField9[0]", formattedDate);
  }

  return fieldsToFill;
}

// Helper function to get CLEO widget variant names
function getCleoWidgetVariant(name: string): string {
  return name
    .replace("Page1[0]", "Page5[0]")
    .replace("Page2[0]", "Page6[0]")
    .replace("#field[24]", "#field[22]");
}

// Main PDF generation function
async function generatePDF(): Promise<void> {
  try {
    console.log("Extracting form data...");
    const formData = getFormData();
    console.log("Form data:", formData);

    const fieldsToFill = mapFormDataToPdfFields(formData);
    console.log("PDF fields to fill:", fieldsToFill);

    console.log("Loading PDF form from static file...");
    const response = await fetch(
      "./static/f_5320.23_national_firearms_act_nfa_responsible_person_questionnaire.pdf",
    );

    if (!response.ok) {
      throw new Error(`Failed to load PDF: ${response.statusText}`);
    }
    
    const pdfBytes = await response.arrayBuffer();

    console.log("Loading PDF document...");
    const doc = mupdf.Document.openDocument(
      new Uint8Array(pdfBytes),
      "application/pdf",
    ) as mupdf.PDFDocument;

    if (!doc.isPDF()) {
      throw new Error("Downloaded file is not a valid PDF");
    }

    console.log("Collecting form widgets...");
    const widgets = new Map<string, mupdf.PDFWidget>();
    const pageCount = doc.countPages();

    for (let pageIndex = 0; pageIndex < pageCount; pageIndex++) {
      const page = doc.loadPage(pageIndex) as mupdf.PDFPage;
      const pageWidgets = page.getWidgets();

      for (const widget of pageWidgets) {
        const fieldName = widget.getName();
        if (fieldName) {
          console.log("Found widget:", fieldName);
          widgets.set(fieldName, widget);
        }
      }
    }

    console.log("Applying alignment changes...");
    const alignmentChanges: Array<[string, [number, number, number, number]]> =
      [
        ["topmostSubform[0].Page2[0].no17[0]", [2.5, 0, 2.5, 0]],
        ["topmostSubform[0].Page2[0].usacheckbox[0]", [1.5, 0, 1.5, 0]],
        ["topmostSubform[0].Page1[0].nhl[0]", [1, 0, 1, 0]],
        ["topmostSubform[0].Page1[0].w[0]", [1, 0, 1, 0]],
        ["topmostSubform[0].Page1[0].#field[24]", [0, -0.5, 0, 0.5]],
      ];

    for (const [widgetName, rectDeltas] of alignmentChanges) {
      for (const widgetNameVariant of [
        widgetName,
        getCleoWidgetVariant(widgetName),
      ]) {
        const widget = widgets.get(widgetNameVariant);
        if (widget) {
          const currentRect = widget.getRect();
          const newRect: mupdf.Rect = [
            currentRect[0] + rectDeltas[0],
            currentRect[1] + rectDeltas[1],
            currentRect[2] + rectDeltas[2],
            currentRect[3] + rectDeltas[3],
          ];
          widget.setRect(newRect);
          widget.update();
        }
      }
    }

    console.log("Filling form fields...");
    for (const [widgetName, answer] of fieldsToFill) {
      for (const widgetNameVariant of [
        widgetName,
        getCleoWidgetVariant(widgetName),
      ]) {
        const widget = widgets.get(widgetNameVariant);
        if (widget) {
          console.log(
            `Filling widget: ${widgetNameVariant} (type: ${widget.getFieldType()})`,
          );
          try {
            if (answer === SELECTED) {
              // For checkboxes/radio buttons, we need to check them
              if (widget.isCheckbox() || widget.isRadioButton()) {
                const result = widget.toggle();
                console.log(`Toggled ${widgetNameVariant}, result: ${result}`);
              } else {
                console.log(
                  `Widget ${widgetNameVariant} is not a checkbox/radio button, skipping SELECTED`,
                );
              }
            } else {
              // Try different methods to set the value based on widget type
              const stringValue = answer as string;

              if (widget.isText()) {
                const result = widget.setTextValue(stringValue);
                console.log(
                  `Set text value for ${widgetNameVariant}: "${stringValue}", result: ${result}`,
                );
              } else if (widget.isChoice()) {
                const result = widget.setChoiceValue(stringValue);
                console.log(
                  `Set choice value for ${widgetNameVariant}: "${stringValue}", result: ${result}`,
                );
              } else {
                // Try text value as fallback for unknown types
                try {
                  const result = widget.setTextValue(stringValue);
                  console.log(
                    `Set text value (fallback) for ${widgetNameVariant}: "${stringValue}", result: ${result}`,
                  );
                } catch (e) {
                  console.log(
                    `Failed to set value for ${widgetNameVariant}, widget type: ${widget.getFieldType()}`,
                  );
                }
              }
            }

            const updateResult = widget.update();
            console.log(
              `Updated widget ${widgetNameVariant}, result: ${updateResult}`,
            );
          } catch (error) {
            console.error(`Error filling widget ${widgetNameVariant}:`, error);
          }
        }
      }
    }

    console.log(`Document has ${doc.countPages()} pages before deletion`);
    console.log("Removing unnecessary pages...");
    // Note: We need to remove in reverse order to maintain indices
    try {
      doc.deletePage(3);
      console.log(`Deleted page 3, now has ${doc.countPages()} pages`);
      doc.deletePage(2);
      console.log(`Deleted page 2, now has ${doc.countPages()} pages`);
    } catch (error) {
      console.error("Error deleting pages:", error);
    }

    console.log("Flattening form fields...");
    doc.flattenForms();

    console.log("Generating PDF buffer...");
    const pdfBuffer = doc.saveToBuffer();

    // Convert to blob and download
    const blob = new Blob([pdfBuffer.asUint8Array()], {
      type: "application/pdf",
    });
    const url = URL.createObjectURL(blob);

    // Create download link and trigger download
    const link = document.createElement("a");
    link.href = url;
    link.download = "5320.23.pdf";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Clean up
    URL.revokeObjectURL(url);
    doc.destroy();

    console.log("PDF generated and download initiated successfully!");
  } catch (error) {
    console.error("Error generating PDF:", error);
    alert(
      `Error generating PDF: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

// Initialize mupdf and set up the interface
console.log("Initializing mupdf...");
console.log("mupdf loaded successfully");

// Make generatePDF function available globally
window.generatePDF = generatePDF;

console.log(
  "PDF generation function is ready. The form can now generate PDFs.",
);
