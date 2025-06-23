document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("nfa-form");

  const getTodayYYYYMMDD = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = (today.getMonth() + 1).toString().padStart(2, "0");
    const day = today.getDate().toString().padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  // --- STATE MANAGEMENT ---
  const serializeForm = () => {
    const data = {};
    const elements = form.elements;
    const processedCheckboxGroups = new Set();
    const todayString = getTodayYYYYMMDD();

    for (const el of elements) {
      if (!el.name || el.disabled) continue;

      switch (el.type) {
        case "checkbox":
          const groupName = el.name;
          if (processedCheckboxGroups.has(groupName)) continue;

          const groupElements = form.elements[groupName];
          if (groupElements.length === undefined) {
            // Single boolean checkbox
            // Special handling for q3a_sameAs2: only store if unchecked (false)
            if (groupName === "q3a_sameAs2") {
              if (!el.checked) {
                data[groupName] = false;
              }
            } else {
              data[groupName] = el.checked;
            }
          } else {
            // Group of checkboxes with values
            const checkedValues = Array.from(groupElements)
              .filter((c) => c.checked)
              .map((c) => c.value);
            if (checkedValues.length > 0) {
              data[groupName] = checkedValues;
            }
          }
          processedCheckboxGroups.add(groupName);
          break;
        case "radio":
          if (el.checked && el.value) {
            data[el.name] = el.value;
          }
          break;
        case "text":
        case "email":
        case "tel":
          // Handle special case for 'other' radio/checkbox text input
          if (el.name.endsWith("_other")) {
            const baseName = el.name.replace("_other", "");
            const controls = form.elements[baseName];
            const otherControl = Array.from(
              controls.length ? controls : [controls],
            ).find((r) => r.value === "OTHER");
            if (otherControl && otherControl.checked && el.value) {
              data[el.name] = el.value.toUpperCase();
            }
          } else if (el.value) {
            data[el.name] = el.value.toUpperCase();
          }
          break;
        case "date":
          // Special handling for certificationDate: only store if not blank and not today
          if (el.name === "certificationDate") {
            if (el.value && el.value !== todayString) {
              data[el.name] = el.value;
            }
          } else if (el.value) {
            data[el.name] = el.value;
          }
          break;
        default:
          if (el.value) {
            // Normalize textarea values to uppercase
            if (el.tagName === "TEXTAREA") {
              data[el.name] = el.value.toUpperCase();
            } else {
              data[el.name] = el.value;
            }
          }
          break;
      }
    }
    return data;
  };

  const deserializeForm = (data) => {
    for (const key in data) {
      const elements = form.elements[key];
      if (!elements) continue;

      let value = data[key];
      const el = elements.length && !elements.tagName ? elements[0] : elements;

      if (el.type === "radio") {
        for (const radio of elements) {
          radio.checked = radio.value === value;
        }
      } else if (el.type === "checkbox") {
        if (typeof value === "boolean") {
          elements.checked = value;
        } else {
          for (const checkbox of elements) {
            checkbox.checked = value.includes(checkbox.value);
          }
        }
      } else {
        // Normalize text values to uppercase when rehydrating
        if (
          typeof value === "string" &&
          (el.type === "text" ||
            el.type === "email" ||
            el.type === "tel" ||
            el.tagName === "TEXTAREA")
        ) {
          value = value.toUpperCase();
        }
        el.value = value;
      }
    }
  };

  const debounce = (func, delay) => {
    let timeout;
    return function (...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), delay);
    };
  };

  const saveStateToHash = () => {
    const data = serializeForm();
    if (Object.keys(data).length > 0) {
      const jsonString = JSON.stringify(data);
      const base64String = btoa(jsonString)
        .replace(/\+/g, "-") // Convert '+' to '-'
        .replace(/\//g, "_") // Convert '/' to '_'
        .replace(/=+$/, ""); // Remove trailing '='
      history.replaceState(null, "", "#" + base64String);
    } else {
      history.replaceState(
        null,
        "",
        window.location.pathname + window.location.search,
      );
    }
  };

  const loadStateFromHash = () => {
    if (window.location.hash) {
      try {
        let base64String = window.location.hash
          .substring(1)
          .replace(/-/g, "+") // Convert '-' back to '+'
          .replace(/_/g, "/"); // Convert '_' back to '/'

        const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
        const jsonString = atob(base64String + padding);

        const data = JSON.parse(jsonString);
        deserializeForm(data);
      } catch (e) {
        console.error("Failed to load state from hash:", e);
      }
    }
  };

  // --- VALIDATION ---
  const validations = {
    q3b_telephone: {
      check: (v) => !v || /^[\d\s\(\)-]+$/.test(v),
      msg: "Must only contain digits and separators.",
    },
    q3c_email: {
      check: (v) => !v || /.+@.+/.test(v),
      msg: "Must be a valid email format.",
    },
    q3f_ssn: {
      check: (v) => !v || /^(\d{3}-\d{2}-\d{4}|\d{9}|[a-zA-Z0-9]{8})$/.test(v),
      msg: "Must be a 9-digit SSN or 8-character UPIN.",
    },
    q3g_dob: {
      check: (v) => !v || new Date(v) <= new Date(),
      msg: "Date of Birth cannot be in the future.",
    },
  };

  const validateField = (field) => {
    if (!field) return true;
    const errorContainer = document.getElementById(field.id + "-error");
    const rule = validations[field.name];
    const value = field.value;
    const isValid = !rule || rule.check(value);

    if (isValid) {
      field.classList.remove("invalid-field");
      if (errorContainer) errorContainer.textContent = "";
    } else {
      field.classList.add("invalid-field");
      if (errorContainer) errorContainer.textContent = rule.msg;
    }
    return isValid;
  };

  const runAllValidations = () => {
    let allValid = true;
    Object.keys(validations).forEach((fieldName) => {
      const field = form.elements[fieldName];
      if (!validateField(field)) {
        allValid = false;
      }
    });
    return allValid;
  };

  // --- UPPERCASE NORMALIZATION ---

  // Function to normalize text inputs to uppercase
  const normalizeToUppercase = (element) => {
    if (
      element.type === "text" ||
      element.type === "email" ||
      element.type === "tel" ||
      element.tagName === "TEXTAREA"
    ) {
      const cursorPos = element.selectionStart;
      const cursorEnd = element.selectionEnd;
      const originalValue = element.value;
      const upperValue = originalValue.toUpperCase();

      if (originalValue !== upperValue) {
        element.value = upperValue;
        // Restore cursor position
        element.setSelectionRange(cursorPos, cursorEnd);
      }
    }
  };

  // Add input event listeners for real-time uppercase conversion
  form.addEventListener("input", (e) => {
    normalizeToUppercase(e.target);
  });

  form.addEventListener("input", debounce(saveStateToHash, 150));
  form.addEventListener("change", saveStateToHash);

  // --- DYNAMIC FIELD LOGIC & FORMATTING ---

  // Auto-expanding textareas with line limits
  const textareaLineLimits = {
    q2_address: 2,
    q3a_homeAddress: 7,
    q5_address: 2,
    q4b_address: 2,
    q3d_otherNames: 2,
  };

  const autoResizeTextarea = (el) => {
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  };

  const limitTextareaLines = (textarea) => {
    const maxLines = textareaLineLimits[textarea.name];
    if (!maxLines) return;

    const lines = textarea.value.split("\n");
    if (lines.length > maxLines) {
      lines.splice(maxLines);
      textarea.value = lines.join("\n");
    }
  };

  form.querySelectorAll("textarea").forEach((textarea) => {
    textarea.addEventListener("input", () => {
      limitTextareaLines(textarea);
      autoResizeTextarea(textarea);
    });
  });

  // Q3a: Same as 2
  const sameAsCheckbox = document.getElementById("q3a_sameAs2");
  const q2Address = document.getElementById("q2_address");
  const q3aHomeAddress = document.getElementById("q3a_homeAddress");

  const syncAddress = () => {
    if (sameAsCheckbox.checked) {
      q3aHomeAddress.value = q2Address.value;
      q3aHomeAddress.disabled = true;
      q3aHomeAddress.dispatchEvent(new Event("input", { bubbles: true })); // to trigger resize
    } else {
      q3aHomeAddress.disabled = false;
    }
  };
  sameAsCheckbox.addEventListener("change", syncAddress);
  q2Address.addEventListener("input", syncAddress);

  // Q3b Phone Formatting
  const phoneInput = document.getElementById("q3b_telephone");
  phoneInput.addEventListener("blur", (e) => {
    const digits = e.target.value.replace(/\D/g, "");
    if (digits.length === 10) {
      e.target.value = `(${digits.substring(0, 3)}) ${digits.substring(3, 6)}-${digits.substring(6, 10)}`;
    }
    // Ensure uppercase after formatting
    normalizeToUppercase(e.target);
  });

  // Q3f SSN Formatting
  const ssnInput = document.getElementById("q3f_ssn");
  ssnInput.addEventListener("blur", (e) => {
    const cleaned = e.target.value.replace(/\D/g, "");
    if (cleaned.length === 9) {
      e.target.value = `${cleaned.substring(0, 3)}-${cleaned.substring(3, 5)}-${cleaned.substring(5, 9)}`;
    }
    // Ensure uppercase after formatting
    normalizeToUppercase(e.target);
  });

  // Q4a: Other firearm type text input
  const otherFirearmRadio = document.getElementById("q4a_other");
  const otherFirearmText = document.getElementById("q4a_other_text");
  form.elements.q4a_firearmType.forEach((radio) => {
    radio.addEventListener("change", () => {
      const isOther = otherFirearmRadio.checked;
      otherFirearmText.disabled = !isOther;
      if (!isOther) otherFirearmText.value = "";
      if (isOther) otherFirearmText.focus();
    });
  });

  // Q6: All No button
  document.getElementById("q6_allNo").addEventListener("click", () => {
    const prohibitors = document.getElementById("q6_prohibitors");
    prohibitors
      .querySelectorAll('input[type="radio"][value="NO"]')
      .forEach((radio) => {
        radio.checked = true;
        radio.dispatchEvent(new Event("change", { bubbles: true }));
      });
    const q6m2na = document.getElementById("q6m2-na");
    q6m2na.checked = true;
    q6m2na.dispatchEvent(new Event("change", { bubbles: true }));
  });

  // Q6m: Dependency logic
  const q6m1Radios = form.elements.q6m1_nonimmigrant;
  const q6m2Radios = form.elements.q6m2_exception;
  const updateQ6m2 = () => {
    const q6m1Yes = document.getElementById("q6m1-yes").checked;
    const q6m1No = document.getElementById("q6m1-no").checked;

    if (q6m1Yes) {
      document.getElementById("q6m2-yes").disabled = false;
      document.getElementById("q6m2-no").disabled = false;
      document.getElementById("q6m2-na").disabled = true;
      if (document.getElementById("q6m2-na").checked) {
        q6m2Radios.forEach((r) => (r.checked = false));
      }
    } else if (q6m1No) {
      document.getElementById("q6m2-yes").disabled = true;
      document.getElementById("q6m2-no").disabled = true;
      document.getElementById("q6m2-na").disabled = false;
      document.getElementById("q6m2-na").checked = true;
    } else {
      // Neither selected
      q6m2Radios.forEach((r) => {
        r.disabled = true;
        r.checked = false;
      });
    }
  };
  q6m1Radios.forEach((r) => r.addEventListener("change", updateQ6m2));

  // Q8: UPIN dependency
  const upinRadios = form.elements.q8_hasUpin;
  const upinNumberInput = document.getElementById("q8_upinNumber");
  const updateUpinInput = () => {
    const hasUpin = document.getElementById("q8_upin-yes").checked;
    upinNumberInput.disabled = !hasUpin;
    if (!hasUpin) upinNumberInput.value = "";
  };
  upinRadios.forEach((r) => r.addEventListener("change", updateUpinInput));

  // Q9a: Citizenship dependency
  const q9aOtherCheckbox = document.getElementById("q9a_other");
  const q9aOtherText = document.getElementById("q9a_other_text");
  q9aOtherCheckbox.addEventListener("change", () => {
    const isOther = q9aOtherCheckbox.checked;
    q9aOtherText.disabled = !isOther;
    if (!isOther) q9aOtherText.value = "";
    if (isOther) q9aOtherText.focus();
  });

  // Q9c: Country of Birth dependency
  const q9cBirthCountryRadios = form.elements.q9c_birthCountry;
  const q9cOtherText = document.getElementById("q9c_other_text");
  const updateQ9cInput = () => {
    const isOther = document.getElementById("q9c_other").checked;
    q9cOtherText.disabled = !isOther;
    if (!isOther) q9cOtherText.value = "";
    if (isOther) q9cOtherText.focus();
  };
  q9cBirthCountryRadios.forEach((r) =>
    r.addEventListener("change", updateQ9cInput),
  );

  // Fill shared blurbs from template
  const blurbTemplate = document.getElementById("blurb-prohibited-person");
  document.querySelectorAll(".blurb-content-container").forEach((container) => {
    const blurbSpan = document.createElement("span");
    blurbSpan.className = "blurb-content";
    blurbSpan.innerHTML = blurbTemplate.innerHTML;
    container.appendChild(blurbSpan);
  });

  // Clear Form Button
  document.getElementById("clear-form").addEventListener("click", () => {
    if (
      confirm(
        "Are you sure you want to clear all fields? This cannot be undone.",
      )
    ) {
      form.reset();
      // After reset, re-run all UI update functions to correctly set disabled states etc.
      runAllUIUpdates();
      saveStateToHash(); // This will clear the hash
    }
  });

  // --- Clear Section Button Logic ---
  document.querySelectorAll(".clear-question-group").forEach((button) => {
    button.addEventListener("click", (e) => {
      const fieldset = e.target.closest(".question-group");
      if (fieldset) {
        const elements = fieldset.querySelectorAll("input, textarea, select");
        elements.forEach((el) => {
          switch (el.type) {
            case "text":
            case "textarea":
            case "email":
            case "tel":
            case "date":
              el.value = el.defaultValue;
              break;
            case "checkbox":
            case "radio":
              el.checked = el.defaultChecked;
              break;
            case "select-one":
            case "select-multiple":
              Array.from(el.options).forEach((option) => {
                option.selected = option.defaultSelected;
              });
              break;
          }
          // Trigger events to update UI (like disabled states) and save to hash
          el.dispatchEvent(new Event("change", { bubbles: true }));
          el.dispatchEvent(new Event("input", { bubbles: true }));
        });
      }
    });
  });

  // Expose serializeForm function globally for TypeScript access
  window.serializeForm = serializeForm;

  // Generate PDF button
  document
    .getElementById("generate-pdf")
    .addEventListener("click", async () => {
      const isFormValid = runAllValidations();
      if (!isFormValid) {
        alert(
          "PLEASE FIX THE HIGHLIGHTED VALIDATION ERRORS BEFORE GENERATING THE PDF.",
        );
        const firstInvalid = form.querySelector(".invalid-field");
        if (firstInvalid) {
          firstInvalid
            .closest(".question-group")
            .scrollIntoView({ behavior: "smooth", block: "center" });
        }
        return;
      }

      // Call the TypeScript generatePDF function
      try {
        if (typeof window.generatePDF === "function") {
          await window.generatePDF();
        } else {
          alert(
            "PDF generation function not loaded. Please ensure the TypeScript module is properly loaded.",
          );
        }
      } catch (error) {
        console.error("Error generating PDF:", error);
        alert(
          `Error generating PDF: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    });

  // --- INITIALIZATION ---
  const runAllUIUpdates = () => {
    syncAddress();
    updateQ6m2();
    updateUpinInput();
    updateQ9cInput();
    form.elements.q4a_firearmType.forEach((radio) =>
      radio.dispatchEvent(new Event("change")),
    );
    form.elements.q9a_citizenship.forEach((cb) =>
      cb.dispatchEvent(new Event("change")),
    );
    form.querySelectorAll("textarea").forEach(autoResizeTextarea);
    Object.keys(validations).forEach((fieldName) =>
      validateField(form.elements[fieldName]),
    );

    // Set certification date if it's empty
    const certDate = document.getElementById("certificationDate");
    if (!certDate.value) {
      certDate.value = getTodayYYYYMMDD();
    }

    // Normalize all existing text values to uppercase on initialization
    form
      .querySelectorAll(
        'input[type="text"], input[type="email"], input[type="tel"], textarea',
      )
      .forEach(normalizeToUppercase);
  };

  // Add blur listeners for validation
  Object.keys(validations).forEach((fieldName) => {
    const field = form.elements[fieldName];
    if (field) {
      field.addEventListener("blur", () => validateField(field));
    }
  });

  loadStateFromHash();
  runAllUIUpdates();
});
