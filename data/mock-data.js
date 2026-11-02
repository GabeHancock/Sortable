/* Sortable MVP prototype: seed data (window.MOCK).
   Owner: Data. All people are made up. Henry Schein, Medline and McKesson are real vendors.
   The store deep-copies this object on init(); nothing else may change it.
   The store also builds the folder tree, sets each filed document's folderId and
   writes the starting activity, so those are left empty here. */
(function () {
  "use strict";

  var TODAY = "2026-10-21";

  var departments = [
    { id: "dept-providers", name: "Providers" },
    { id: "dept-clinical", name: "Clinical staff" },
    { id: "dept-front", name: "Front desk" },
    { id: "dept-billing", name: "Billing" },
    { id: "dept-admin", name: "Administration" }
  ];

  // Role -> department (CLAUDE.md "Decisions already made" -> Departments).
  var DEPT_FOR_ROLE = {
    "Physician": "dept-providers",
    "Nurse practitioner": "dept-providers",
    "Physician assistant": "dept-providers",
    "Registered nurse": "dept-clinical",
    "Medical assistant": "dept-clinical",
    "Radiology technician": "dept-clinical",
    "Lab technician": "dept-clinical",
    "Front desk": "dept-front",
    "Front desk lead": "dept-front",
    "Scheduler": "dept-front",
    "Billing specialist": "dept-billing",
    "Office manager": "dept-admin",
    "IT coordinator": "dept-admin",
    "Facilities": "dept-admin"
  };

  var employees = [
    { id: "emp-01", name: "Marisol Vance", role: "Physician", startDate: "2014-08-04" },
    { id: "emp-02", name: "Theo Lindqvist", role: "Physician", startDate: "2017-03-13" },
    { id: "emp-03", name: "Priya Ramaswamy", role: "Registered nurse", startDate: "2019-06-03" },
    { id: "emp-04", name: "Dashiell Moreau", role: "Medical assistant", startDate: "2021-01-11" },
    { id: "emp-05", name: "Keiko Abernathy", role: "Front desk lead", startDate: "2018-09-24" },
    { id: "emp-06", name: "Rafael Quintero", role: "Radiology technician", startDate: "2016-05-16" },
    { id: "emp-07", name: "Adaeze Okafor", role: "Nurse practitioner", startDate: "2020-02-10" },
    { id: "emp-08", name: "Lorcan Whitfield", role: "Physician assistant", startDate: "2022-07-18" },
    { id: "emp-09", name: "Sunniva Halvorsen", role: "Registered nurse", startDate: "2015-11-02" },
    { id: "emp-10", name: "Bastian Oyelaran", role: "Medical assistant", startDate: "2023-04-03" },
    { id: "emp-11", name: "Imogen Castellano", role: "Physician", startDate: "2012-10-01" },
    { id: "emp-12", name: "Wendell Ashby", role: "Billing specialist", startDate: "2026-02-02" },
    { id: "emp-13", name: "Noor Haddadin", role: "Scheduler", startDate: "2025-08-11" },
    { id: "emp-14", name: "Caspian Delacroix", role: "Medical assistant", startDate: "2024-03-25" },
    { id: "emp-15", name: "Talia Brennan-Reyes", role: "Registered nurse", startDate: "2021-09-13" },
    { id: "emp-16", name: "Orrin Szabo", role: "Office manager", startDate: "2013-01-07" },
    { id: "emp-17", name: "Esperanza Liang", role: "Medical assistant", startDate: "2022-11-14" },
    { id: "emp-18", name: "Jory Pemberton", role: "Front desk", startDate: "2023-06-19" },
    { id: "emp-19", name: "Ximena Albescu", role: "Billing specialist", startDate: "2019-02-25" },
    { id: "emp-20", name: "Hollis Mbeki-Grant", role: "Lab technician", startDate: "2020-08-31" },
    { id: "emp-21", name: "Saoirse Kettering", role: "Registered nurse", startDate: "2018-04-09" },
    { id: "emp-22", name: "Anselm Vortigern", role: "Physician", startDate: "2021-07-06" },
    { id: "emp-23", name: "Mireille Tanaka-Ross", role: "Medical assistant", startDate: "2024-10-07" },
    { id: "emp-24", name: "Desmond Achterberg", role: "IT coordinator", startDate: "2017-12-04" },
    { id: "emp-25", name: "Fenna Rasmusen", role: "Scheduler", startDate: "2022-01-24" },
    { id: "emp-26", name: "Gideon Nwachukwu-Hale", role: "Radiology technician", startDate: "2019-10-14" },
    { id: "emp-27", name: "Liesel Montague", role: "Registered nurse", startDate: "2016-08-22" },
    { id: "emp-28", name: "Ravi Thornbury", role: "Physician assistant", startDate: "2023-09-05" },
    { id: "emp-29", name: "Odalys Fairweather", role: "Front desk", startDate: "2025-03-17" },
    { id: "emp-30", name: "Kasimir Bellweather", role: "Lab technician", startDate: "2020-05-11" },
    { id: "emp-31", name: "Annika Solberg-Diaz", role: "Medical assistant", startDate: "2021-12-06" },
    { id: "emp-32", name: "Tobiah Rennick", role: "Billing specialist", startDate: "2018-07-30" },
    { id: "emp-33", name: "Calla Whitcombe", role: "Registered nurse", startDate: "2022-04-18" },
    { id: "emp-34", name: "Emeric Ludovici", role: "Physician", startDate: "2015-09-08" },
    { id: "emp-35", name: "Juniper Akintola", role: "Medical assistant", startDate: "2024-06-24" },
    { id: "emp-36", name: "Matthias Corrigan", role: "Facilities", startDate: "2014-02-17" },
    { id: "emp-37", name: "Rosalind Ishikawa", role: "Scheduler", startDate: "2023-01-09" },
    { id: "emp-38", name: "Silas Underhill", role: "Lab technician", startDate: "2019-04-29" },
    { id: "emp-39", name: "Wren Oduya", role: "Front desk", startDate: "2025-11-03" },
    { id: "emp-40", name: "Yusra Kallander", role: "Registered nurse", startDate: "2020-10-26" }
  ].map(function (e) {
    return { id: e.id, name: e.name, role: e.role, departmentId: DEPT_FOR_ROLE[e.role], startDate: e.startDate };
  });

  var vendors = [
    { id: "ven-01", name: "Henry Schein", category: "Medical supplies" },
    { id: "ven-02", name: "Medline", category: "Medical supplies" },
    { id: "ven-03", name: "Brightline Lab Services", category: "Reference lab" },
    { id: "ven-04", name: "Cascade Medical Waste", category: "Waste disposal" },
    { id: "ven-05", name: "Summit Office Supply", category: "Office supplies" },
    { id: "ven-06", name: "Northbay Linen", category: "Linen service" },
    { id: "ven-07", name: "McKesson", category: "Medical supplies" },   // no documents until in-05
    { id: "ven-08", name: "ClearPath IT", category: "IT services" }
  ];

  var LABELS = {
    invoice: "Invoice", license: "License", certification: "Certification", training: "Training",
    hr_form: "HR form", contract: "Contract", compliance: "Compliance", medical: "Medical record", other: "Document"
  };

  function byId(list, id) {
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  // Same rule as Sortable.ai.matchKey (see CLAUDE.md "Learning from corrections").
  function matchKey(channel, sender, filename) {
    if (channel !== "upload") return String(sender).toLowerCase();
    var k = String(filename).toLowerCase().replace(/\.[^.]*$/, "");
    var m = k.search(/[0-9]/);
    if (m >= 0) k = k.slice(0, m);
    return k.replace(/[_\-. ]+$/, "");
  }

  function filedName(type, employeeId, vendorId, docDate) {
    var emp = employeeId && byId(employees, employeeId);
    var ven = vendorId && byId(vendors, vendorId);
    var middle = emp ? emp.name : ven ? ven.name : "Practice";
    return LABELS[type] + " – " + middle + " – " + docDate;
  }

  function result(type, employeeId, vendorId, topic) {
    return { type: type, employeeId: employeeId || null, vendorId: vendorId || null, topic: topic || null };
  }

  var n = 0;
  // d: { filename, type, channel, sender, receivedOn?, modifiedOn?, docDate, employeeId?, vendorId?, topic?, text,
  //      amountCents?, dueDate?, paidOn?, expiresOn?, renewedOn?, requestedOn?, review?, confidence?,
  //      alternatives?, starred?, deletedOn? }
  function doc(d) {
    n += 1;
    var isInvoice = d.type === "invoice";
    var isCred = d.type === "license" || d.type === "certification" || d.type === "training";
    var review = !!d.review;
    var receivedOn = d.receivedOn || d.docDate;
    return {
      id: "doc-" + (n < 10 ? "00" : n < 100 ? "0" : "") + n,
      filename: d.filename,
      name: review ? d.filename : filedName(d.type, d.employeeId, d.vendorId, d.docDate),
      renamed: false,
      type: d.type,
      topic: d.type === "compliance" ? d.topic || null : null,
      folderId: null,                 // the store sets it for filed documents
      status: review ? "review" : "filed",
      confidence: d.confidence != null ? d.confidence : 0.96,
      alternatives: review ? d.alternatives : [],
      suggested: review ? result(d.type, d.employeeId, d.vendorId, d.topic) : null,
      matchKey: matchKey(d.channel, d.sender, d.filename),
      channel: d.channel,
      sender: d.sender,
      receivedOn: receivedOn,
      modifiedOn: d.modifiedOn || d.deletedOn || d.paidOn || d.renewedOn || d.requestedOn || receivedOn,
      docDate: d.docDate,
      employeeId: d.employeeId || null,
      vendorId: d.vendorId || null,
      text: d.text,
      invoice: isInvoice ? { amountCents: d.amountCents, dueDate: d.dueDate || null, paidOn: d.paidOn || null } : null,
      expiresOn: isCred ? d.expiresOn || null : null,
      renewedOn: isCred ? d.renewedOn || null : null,
      requestedOn: isCred ? d.requestedOn || null : null,
      filedBy: review ? null : "auto",
      location: "Main office",
      starred: !!d.starred,
      deletedOn: d.deletedOn || null,
      copyOf: null,
      hasFile: false,
      activity: []                    // the store writes the starting events
    };
  }

  var documents = [
    // ---- Invoices (10, across 7 vendors, 4 paid) ----
    doc({ filename: "HenrySchein_Invoice_2026-03-12.pdf", type: "invoice", channel: "email", sender: "ap@henryschein.com",
      docDate: "2026-03-12", vendorId: "ven-01", amountCents: 245610, dueDate: "2026-04-11", paidOn: "2026-04-02",
      text: "Henry Schein invoice for exam gloves, nitrile, size M (40 boxes) and sterilization pouches. Total $2,456.10, net 30." }),
    doc({ filename: "HenrySchein_Invoice_2026-06-18.pdf", type: "invoice", channel: "email", sender: "ap@henryschein.com",
      docDate: "2026-06-18", vendorId: "ven-01", amountCents: 98745, dueDate: "2026-07-18", paidOn: "2026-07-10",
      text: "Henry Schein invoice for syringes, alcohol prep pads and gauze. Total $987.45, net 30." }),
    doc({ filename: "HenrySchein_Invoice_2026-09-28.pdf", type: "invoice", channel: "email", sender: "ap@henryschein.com",
      docDate: "2026-09-28", vendorId: "ven-01", amountCents: 173220, dueDate: "2026-10-28",
      text: "Henry Schein invoice for face masks, exam table paper and disinfectant wipes. Total $1,732.20, due Oct 28." }),
    doc({ filename: "Medline_Invoice_0922.pdf", type: "invoice", channel: "email", sender: "billing@medline.com",
      docDate: "2026-09-22", vendorId: "ven-02", amountCents: 312480, dueDate: "2026-10-22",
      text: "Medline invoice for wound care supplies and patient gowns. Total $3,124.80, due Oct 22." }),
    doc({ filename: "Medline_Invoice_0805.pdf", type: "invoice", channel: "email", sender: "billing@medline.com",
      docDate: "2026-08-05", vendorId: "ven-02", amountCents: 154300, dueDate: "2026-09-04", paidOn: "2026-08-30",
      text: "Medline invoice for exam gloves and sharps containers. Total $1,543.00, net 30." }),
    doc({ filename: "brightline_inv_7731.pdf", type: "invoice", channel: "fax", sender: "+1 555 0163",
      docDate: "2026-09-10", vendorId: "ven-03", amountCents: 86500, dueDate: "2026-10-10",
      text: "Brightline Lab Services invoice for outside lab panels, August. Total $865.00, due Oct 10." }),
    doc({ filename: "Cascade_Invoice_Oct.pdf", type: "invoice", channel: "email", sender: "invoices@cascademw.com",
      docDate: "2026-10-01", vendorId: "ven-04", amountCents: 42000, dueDate: "2026-10-31",
      text: "Cascade Medical Waste invoice for monthly sharps and biohazard pickup, October. Total $420.00." }),
    doc({ filename: "summit_order_5521.pdf", type: "invoice", channel: "email", sender: "orders@summitoffice.com",
      docDate: "2026-07-15", vendorId: "ven-05", amountCents: 21899, dueDate: "2026-08-14", paidOn: "2026-08-10",
      text: "Summit Office Supply invoice for printer toner, copy paper and file folders. Total $218.99." }),
    doc({ filename: "northbay_statement_1005.pdf", type: "invoice", channel: "email", sender: "accounts@northbaylinen.com",
      docDate: "2026-10-05", vendorId: "ven-06", amountCents: 36750, dueDate: "2026-11-04",
      text: "Northbay Linen invoice for weekly lab coat and gown laundering, September. Total $367.50." }),
    doc({ filename: "ClearPath_Invoice_Oct.pdf", type: "invoice", channel: "email", sender: "billing@clearpathit.com",
      receivedOn: TODAY, docDate: "2026-10-12", vendorId: "ven-08", amountCents: 129900,
      text: "ClearPath IT invoice for monthly managed IT support and backup. Total $1,299.00. No due date printed." }),

    // ---- Credentials: licenses, certifications, trainings (14) ----
    doc({ filename: "license_okafor_2024.pdf", type: "license", channel: "upload", sender: "upload",
      docDate: "2024-11-10", employeeId: "emp-07", expiresOn: "2026-11-10",
      text: "State board nurse practitioner license for Adaeze Okafor. Expires November 10, 2026." }),
    doc({ filename: "bls_cert_ramaswamy.pdf", type: "certification", channel: "upload", sender: "upload",
      docDate: "2024-12-05", employeeId: "emp-03", expiresOn: "2026-12-05",
      text: "Basic Life Support (BLS) certification for Priya Ramaswamy. Expires December 5, 2026." }),
    doc({ filename: "vance_medical_license.pdf", type: "license", channel: "upload", sender: "upload",
      docDate: "2025-06-30", employeeId: "emp-01", expiresOn: "2027-06-30", starred: true,
      text: "State medical license for Marisol Vance, MD, medical director. Expires June 30, 2027." }),
    doc({ filename: "lindqvist_medical_license.pdf", type: "license", channel: "upload", sender: "upload",
      docDate: "2025-03-31", employeeId: "emp-02", expiresOn: "2027-03-31",
      text: "State medical license for Theo Lindqvist, MD. Expires March 31, 2027." }),
    doc({ filename: "cma_cert_moreau.pdf", type: "certification", channel: "upload", sender: "upload",
      docDate: "2021-10-01", employeeId: "emp-04", expiresOn: "2026-10-01",
      text: "Certified Medical Assistant (CMA) certification for Dashiell Moreau. Expired October 1, 2026." }),
    doc({ filename: "hipaa_training_abernathy.pdf", type: "training", channel: "upload", sender: "upload",
      docDate: "2026-08-15", employeeId: "emp-05", expiresOn: "2027-08-15",
      text: "Annual HIPAA privacy training certificate for Keiko Abernathy. Valid until August 15, 2027." }),
    doc({ filename: "arrt_cert_quintero_2024.pdf", type: "certification", channel: "upload", sender: "upload",
      docDate: "2024-09-15", employeeId: "emp-06", expiresOn: "2026-09-15", renewedOn: "2026-09-01",
      text: "Radiologic technologist (ARRT) certification for Rafael Quintero. Expires September 15, 2026." }),
    doc({ filename: "arrt_cert_quintero_2026.pdf", type: "certification", channel: "upload", sender: "upload",
      docDate: "2026-09-01", employeeId: "emp-06", expiresOn: "2028-09-15",
      text: "Renewed radiologic technologist (ARRT) certification for Rafael Quintero. Expires September 15, 2028." }),
    doc({ filename: "whitfield_pa_license.pdf", type: "license", channel: "upload", sender: "upload",
      docDate: "2024-12-31", employeeId: "emp-08", expiresOn: "2026-12-31",
      text: "Physician assistant license for Lorcan Whitfield. Expires December 31, 2026." }),
    doc({ filename: "acls_cert_halvorsen.pdf", type: "certification", channel: "upload", sender: "upload",
      docDate: "2025-02-28", employeeId: "emp-09", expiresOn: "2027-02-28",
      text: "Advanced Cardiac Life Support (ACLS) certification for Sunniva Halvorsen. Expires February 28, 2027." }),
    doc({ filename: "bbp_training_halvorsen.pdf", type: "training", channel: "upload", sender: "upload",
      docDate: "2025-11-30", employeeId: "emp-09", expiresOn: "2026-11-30", requestedOn: "2026-10-07",
      text: "Bloodborne pathogens training certificate for Sunniva Halvorsen. Valid until November 30, 2026. Updated version requested." }),
    doc({ filename: "osha_training_oyelaran.pdf", type: "training", channel: "upload", sender: "upload",
      docDate: "2025-11-30", employeeId: "emp-10", expiresOn: "2026-11-30",
      text: "OSHA bloodborne pathogens training certificate for Bastian Oyelaran. Valid until November 30, 2026." }),
    doc({ filename: "castellano_medical_license.pdf", type: "license", channel: "upload", sender: "upload",
      docDate: "2026-01-31", employeeId: "emp-11", expiresOn: "2028-01-31",
      text: "State medical license for Imogen Castellano, MD. Expires January 31, 2028." }),
    doc({ filename: "kettering_bls_card.pdf", type: "certification", channel: "upload", sender: "upload",
      docDate: "2024-10-29", employeeId: "emp-21", expiresOn: "2026-10-29",
      text: "CPR and Basic Life Support (BLS) card for Saoirse Kettering. Expires October 29, 2026." }),

    // ---- HR (4) ----
    doc({ filename: "i9_ashby.pdf", type: "hr_form", channel: "upload", sender: "upload",
      docDate: "2026-02-02", employeeId: "emp-12",
      text: "Form I-9 employment eligibility verification for Wendell Ashby." }),
    doc({ filename: "w4_haddadin.pdf", type: "hr_form", channel: "upload", sender: "upload",
      docDate: "2025-08-11", employeeId: "emp-13",
      text: "Form W-4 tax withholding for Noor Haddadin." }),
    doc({ filename: "direct_deposit_delacroix.pdf", type: "hr_form", channel: "upload", sender: "upload",
      docDate: "2024-03-25", employeeId: "emp-14",
      text: "Direct deposit authorization form for Caspian Delacroix." }),
    doc({ filename: "emergency_contact_okafor.pdf", type: "hr_form", channel: "upload", sender: "upload",
      docDate: "2025-01-15", employeeId: "emp-07",
      text: "Emergency contact form for Adaeze Okafor." }),

    // ---- Vendors: contracts and other vendor documents (4) ----
    doc({ filename: "Medline_Supply_Agreement_2026.pdf", type: "contract", channel: "email", sender: "contracts@medline.com",
      docDate: "2026-01-15", vendorId: "ven-02", starred: true,
      text: "Medline supply agreement with tiered pricing on gloves and gowns. Term January 2026 to December 2027." }),
    doc({ filename: "clearpath_msa.pdf", type: "contract", channel: "email", sender: "billing@clearpathit.com",
      docDate: "2025-11-01", vendorId: "ven-08",
      text: "ClearPath IT managed services agreement. Monthly support, backups and HIPAA-compliant email." }),
    doc({ filename: "cascade_service_contract.pdf", type: "contract", channel: "fax", sender: "+1 555 0188",
      docDate: "2026-02-01", vendorId: "ven-04",
      text: "Cascade Medical Waste service contract for monthly biohazard and sharps pickup." }),
    doc({ filename: "summit_w9.pdf", type: "other", channel: "email", sender: "orders@summitoffice.com",
      docDate: "2026-05-20", vendorId: "ven-05",
      text: "Summit Office Supply W-9 taxpayer identification form." }),

    // ---- Compliance (4, by topic) ----
    doc({ filename: "osha_training_log_2026.pdf", type: "compliance", topic: "OSHA", channel: "upload", sender: "upload",
      docDate: "2026-01-20", text: "OSHA bloodborne pathogens training sign-in log for all clinical staff, 2026." }),
    doc({ filename: "hipaa_risk_assessment_2025.pdf", type: "compliance", topic: "HIPAA", channel: "upload", sender: "upload",
      docDate: "2025-11-15", text: "HIPAA security risk assessment, 2025. Next update due October 2026." }),
    doc({ filename: "fire_inspection_report.pdf", type: "compliance", topic: "Inspection", channel: "fax", sender: "+1 555 0119",
      docDate: "2026-09-28", text: "Fire marshal inspection report. Extinguishers inspected and tagged. Passed." }),
    doc({ filename: "sterilizer_service_0914.pdf", type: "compliance", topic: "Inspection", channel: "upload", sender: "upload",
      docDate: "2026-09-14", text: "Annual service and spore test for the autoclave in the sterilization room. Passed. Next service due December 2026." }),

    // ---- Confidential Medical (4, for 3 employees) ----
    doc({ filename: "okafor_immunization_record.pdf", type: "medical", channel: "upload", sender: "upload",
      docDate: "2025-09-10", employeeId: "emp-07",
      text: "Employee immunization record for Adaeze Okafor: hepatitis B series, MMR and annual flu vaccine." }),
    doc({ filename: "okafor_tb_test_2026.pdf", type: "medical", channel: "upload", sender: "upload",
      docDate: "2026-03-02", employeeId: "emp-07",
      text: "Annual tuberculosis skin test result for Adaeze Okafor. Negative." }),
    doc({ filename: "kettering_hepb_vaccination.pdf", type: "medical", channel: "upload", sender: "upload",
      docDate: "2025-05-19", employeeId: "emp-21",
      text: "Hepatitis B vaccination record for Saoirse Kettering, three doses complete." }),
    doc({ filename: "delacroix_fitness_for_duty.pdf", type: "medical", channel: "fax", sender: "+1 555 0131",
      docDate: "2026-06-08", employeeId: "emp-14",
      text: "Return-to-work fitness for duty note for Caspian Delacroix from the treating clinic." }),

    // ---- Practice documents (2; the cover sheet is in the trash) ----
    doc({ filename: "employee_handbook_2026.pdf", type: "other", channel: "upload", sender: "upload",
      receivedOn: TODAY, docDate: "2026-01-05",
      text: "Staff handbook and office policy manual, 2026 edition. Dress code, time off and phone etiquette." }),
    doc({ filename: "fax_cover_sheet_old.pdf", type: "other", channel: "fax", sender: "+1 555 0177",
      docDate: "2026-10-12", deletedOn: "2026-10-18",
      text: "Blank fax cover sheet. No other pages." }),

    // ---- Review queue (3) ----
    doc({ review: true, filename: "fax_0177.pdf", type: "hr_form", channel: "fax", sender: "+1 555 0177",
      receivedOn: "2026-10-19", docDate: "2026-10-16", employeeId: "emp-15", confidence: 0.62,
      text: "Faxed form, partly legible. Mentions Talia Brennan-Reyes and a signature line.",
      alternatives: [
        result("certification", "emp-15"),
        result("training", "emp-15"),
        result("hr_form", "emp-21")
      ] }),
    doc({ review: true, filename: "statement_0915.pdf", type: "invoice", channel: "email", sender: "office@northbaylinen.com",
      receivedOn: "2026-10-20", docDate: "2026-09-15", vendorId: "ven-06", confidence: 0.71,
      amountCents: 36750, dueDate: "2026-10-15",
      text: "Northbay Linen statement for August service. Balance $367.50.",
      alternatives: [
        result("contract", null, "ven-06"),
        result("other", null, "ven-06")
      ] }),
    doc({ review: true, filename: "cpr_card_scan.pdf", type: "certification", channel: "upload", sender: "upload",
      receivedOn: "2026-10-21", docDate: "2026-10-14", employeeId: "emp-17", confidence: 0.55, expiresOn: "2028-10-14",
      text: "Photo of a CPR card. Name partly cut off: \"Esperanza L...\". Valid two years.",
      alternatives: [
        result("training", "emp-17"),
        result("certification", "emp-31"),
        result("hr_form", "emp-17")
      ] })
  ];

  function docIdByFile(filename) {
    for (var i = 0; i < documents.length; i++) if (documents[i].filename === filename) return documents[i].id;
    return null;
  }

  window.MOCK = {
    today: TODAY,
    practice: {
      name: "Riverbend Eye Specialists",
      specialty: "Ophthalmology",
      staffCount: 40,
      forwardEmail: "riverbend-eye@in.sortable.example",
      faxNumber: "+1 555 0100",
      locations: ["Main office"]
    },
    viewer: { employeeId: "emp-16", label: "You (office manager)" },
    storage: { name: "Sortable cloud", sub: "Encrypted, backed up nightly", status: "connected" },
    departments: departments,

    employees: employees,
    vendors: vendors,
    documents: documents,
    folders: [],

    compliance: [
      { id: "cmp-01", title: "Annual OSHA bloodborne pathogens training", category: "OSHA", dueOn: "2026-11-15", resolvedOn: null, documentId: docIdByFile("osha_training_log_2026.pdf") },
      { id: "cmp-02", title: "HIPAA security risk assessment update", category: "HIPAA", dueOn: "2026-10-15", resolvedOn: null, documentId: docIdByFile("hipaa_risk_assessment_2025.pdf") },
      { id: "cmp-03", title: "Fire extinguisher inspection", category: "Inspection", dueOn: "2026-09-30", resolvedOn: "2026-09-28", documentId: docIdByFile("fire_inspection_report.pdf") },
      { id: "cmp-04", title: "State facility license renewal", category: "Renewal", dueOn: "2027-01-31", resolvedOn: null, documentId: null },
      { id: "cmp-05", title: "Autoclave spore test and service", category: "Inspection", dueOn: "2026-12-15", resolvedOn: null, documentId: docIdByFile("sterilizer_service_0914.pdf") },
      { id: "cmp-06", title: "DEA registration renewal", category: "Renewal", dueOn: "2026-12-20", resolvedOn: null, documentId: null }
    ],

    incoming: [
      { id: "in-01", channel: "email", sender: "ap@henryschein.com", filename: "HenrySchein_Invoice_Oct.pdf",
        text: "Henry Schein invoice for exam gloves, sterilization pouches and cotton rolls. Total $1,864.25, due Nov 19.",
        fields: { docDate: "2026-10-20", amountCents: 186425, dueDate: "2026-11-19", expiresOn: null } },
      { id: "in-02", channel: "fax", sender: "+1 555 0142", filename: "fax_0142.pdf",
        text: "Unreadable fax. The page is mostly dark streaks and no words can be made out.",
        fields: { docDate: null, amountCents: null, dueDate: null, expiresOn: null } },
      { id: "in-03", channel: "email", sender: "billing@medline.com", filename: "Medline_statement_Oct.pdf",
        text: "Medline statement for October. Exam gloves and patient gowns. Amount due $2,210.40 by Nov 18.",
        fields: { docDate: "2026-10-19", amountCents: 221040, dueDate: "2026-11-18", expiresOn: null } },
      { id: "in-04", channel: "email", sender: "billing@medline.com", filename: "Medline_statement_Nov.pdf",
        text: "Medline statement for November. Wound care supplies. Amount due $1,478.90 by Dec 20.",
        fields: { docDate: "2026-10-21", amountCents: 147890, dueDate: "2026-12-20", expiresOn: null } },
      { id: "in-05", channel: "email", sender: "orders@mckesson.com", filename: "McKesson_Invoice_1021.pdf",
        text: "McKesson invoice for vaccines, flu season stock, and specimen cups. Total $2,987.60, due Nov 20.",
        fields: { docDate: "2026-10-21", amountCents: 298760, dueDate: "2026-11-20", expiresOn: null } }
    ],

    filingRules: [
      { id: "rule-01", match: "henryschein.com", confidence: 0.96,
        result: result("invoice", null, "ven-01"),
        alternatives: [result("contract", null, "ven-01")],
        fields: { amountCents: null, dueInDays: 30, expiresInDays: null } },
      { id: "rule-02", match: "medline.com", confidence: 0.70,
        result: result("contract", null, "ven-02"),
        alternatives: [result("invoice", null, "ven-02"), result("other", null, "ven-02")],
        fields: { amountCents: null, dueInDays: 30, expiresInDays: null } },
      { id: "rule-03", match: "license_renewal_okafor", confidence: 0.92,
        result: result("license", "emp-07"),
        alternatives: [result("certification", "emp-07")],
        fields: { amountCents: null, dueInDays: null, expiresInDays: 730 } },
      { id: "rule-04", match: "cascademw.com", confidence: 0.94,
        result: result("invoice", null, "ven-04"),
        alternatives: [result("contract", null, "ven-04")],
        fields: { amountCents: null, dueInDays: 30, expiresInDays: null } },
      { id: "rule-05", match: "summitoffice.com", confidence: 0.93,
        result: result("invoice", null, "ven-05"),
        alternatives: [result("other", null, "ven-05")],
        fields: { amountCents: null, dueInDays: 30, expiresInDays: null } },
      { id: "rule-06", match: "clearpathit.com", confidence: 0.90,
        result: result("invoice", null, "ven-08"),
        alternatives: [result("contract", null, "ven-08")],
        fields: { amountCents: null, dueInDays: null, expiresInDays: null } },
      { id: "rule-07", match: "mckesson.com", confidence: 0.94,
        result: result("invoice", null, "ven-07"),
        alternatives: [result("contract", null, "ven-07")],
        fields: { amountCents: null, dueInDays: 30, expiresInDays: null } }
    ]
  };
})();
