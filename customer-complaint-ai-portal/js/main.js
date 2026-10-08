/**
 * main.js - Core Frontend Controller for Customer Complaint Classification & Resolution Assistant
 * Provides seamless integration with Python Flask backend or standalone browser simulation.
 */

// Application State
const AppState = {
    backendUrl: "http://127.0.0.1:5000",
    mode: "auto", // 'auto', 'live', 'browser'
    isBackendOnline: false,
    currentResult: null,
    tickets: [],
    charts: {
        category: null,
        trend: null,
        priority: null
    }
};

// Benchmark Presets
const SAMPLE_PRESETS = {
    billing: {
        customer: "Sarah Jenkins (s.jenkins@email.com)",
        text: "I was charged twice $189.50 on my credit card statement for order #INV-88421 on October 2nd. I tried calling customer service twice and was put on hold for 40 minutes before getting disconnected. I demand an immediate reversal and confirmation email!"
    },
    delivery: {
        customer: "Michael Torres (m.torres@gmail.com)",
        text: "My order with tracking ID #TRK-990422 was scheduled for guaranteed delivery on Friday. It arrived 4 days late, and the exterior box was crushed. Inside, the ceramic dinnerware was shattered into pieces. I need an urgent replacement or full refund."
    },
    security: {
        customer: "David Chen (d.chen@outlook.com)",
        text: "CRITICAL SECURITY ALERT! I received an email saying my account password and registered phone number were changed from an unrecognized device in Frankfurt. There is a pending transaction of $650 that I did NOT authorize! Please freeze my account immediately!"
    },
    product: {
        customer: "Emily Watson (emily.w@yahoo.com)",
        text: "The UltraBook Pro 15 laptop I received yesterday has severe screen flickering and the cooling fan emits a loud screeching noise within 5 minutes of booting. When I tried requesting a return, your portal threw 'Policy Non-Eligible'. This is unacceptable for a brand new $1,200 product."
    },
    tech: {
        customer: "Rahul Sharma (rahul.s@techmail.com)",
        text: "The checkout screen on the iOS mobile application (v3.4.1) crashes immediately when selecting UPI / Debit Card payment. The money ($85.00) got debited from my bank account with transaction ref #TXN-77312, but the app shows 'Payment Failed' and no order was generated."
    },
    service: {
        customer: "Amanda Miller (a.miller@service.net)",
        text: "I spoke with representative Mark on the phone today regarding my account upgrade. He was extremely discourteous, interrupted me continuously, and abruptly disconnected the call when I asked to speak to a shift supervisor. I want this call reviewed and an apology."
    }
};

// Category Definitions & Themes
const CATEGORIES = [
    { id: "Billing & Payment", color: "#2563eb", badgeClass: "bg-primary" },
    { id: "Logistics & Delivery", color: "#06b6d4", badgeClass: "bg-info text-dark" },
    { id: "Account & Security", color: "#dc2626", badgeClass: "bg-danger" },
    { id: "Product Defects", color: "#d97706", badgeClass: "bg-warning text-dark" },
    { id: "Customer Service", color: "#64748b", badgeClass: "bg-secondary" },
    { id: "Technical & App Bugs", color: "#7c3aed", badgeClass: "bg-purple text-white" }
];

// Initialize on DOM Ready
document.addEventListener("DOMContentLoaded", () => {
    initCharCounter();
    loadTicketsFromStorage();
    initCharts();
    checkBackendHealth();
    renderTicketsTable();
});

// Character Counter
function initCharCounter() {
    const textarea = document.getElementById("complaintText");
    const countBadge = document.getElementById("charCount");
    if (!textarea || !countBadge) return;

    textarea.addEventListener("input", () => {
        const len = textarea.value.length;
        countBadge.innerText = `${len} characters`;
    });
}

// Load Benchmark Presets into Form
function loadSamplePreset(presetKey) {
    const data = SAMPLE_PRESETS[presetKey];
    if (!data) return;

    document.getElementById("customerName").value = data.customer;
    const textarea = document.getElementById("complaintText");
    textarea.value = data.text;
    document.getElementById("charCount").innerText = `${data.text.length} characters`;

    // Highlight text area
    textarea.focus();
    textarea.classList.add("border-primary");
    setTimeout(() => textarea.classList.remove("border-primary"), 600);
}

// Reset Form
function resetForm() {
    document.getElementById("customerName").value = "";
    document.getElementById("complaintText").value = "";
    document.getElementById("charCount").innerText = "0 characters";
    document.getElementById("emptyResultState").classList.remove("d-none");
    document.getElementById("resultsContent").classList.add("d-none");
    document.getElementById("modelInferenceTime").innerText = "Ready";
    AppState.currentResult = null;
}

// Backend Health Check
async function checkBackendHealth() {
    const statusDot = document.getElementById("statusDot");
    const statusText = document.getElementById("statusText");
    const pingStatus = document.getElementById("pingStatus");

    if (AppState.mode === "browser") {
        AppState.isBackendOnline = false;
        statusDot.className = "status-dot online";
        statusText.innerText = "Mode: Browser Simulation Engine";
        if (pingStatus) pingStatus.innerText = "Status: Browser Simulation (Active)";
        return;
    }

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);
        const res = await fetch(`${AppState.backendUrl}/api/health`, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (res.ok) {
            AppState.isBackendOnline = true;
            statusDot.className = "status-dot online";
            statusText.innerText = "Mode: Live Python Backend (Flask)";
            if (pingStatus) pingStatus.innerText = "Status: Connected to " + AppState.backendUrl;
        } else {
            throw new Error("HTTP " + res.status);
        }
    } catch (err) {
        AppState.isBackendOnline = false;
        statusDot.className = "status-dot offline";
        statusText.innerText = "Mode: Offline / Browser Hybrid (Ready)";
        if (pingStatus) pingStatus.innerText = "Status: Offline (Using Browser AI Engine)";
    }
}

// Test Backend Connection from Modal
function testBackendConnection() {
    AppState.backendUrl = document.getElementById("configApiUrl").value.trim();
    checkBackendHealth();
}

function updateBackendMode() {
    AppState.mode = document.getElementById("configBackendMode").value;
    checkBackendHealth();
}

// Process Complaint (Dispatch to Backend or Browser Simulation)
async function processComplaint() {
    const complaintText = document.getElementById("complaintText").value.trim();
    const customerName = document.getElementById("customerName").value.trim() || "Anonymous Customer";

    if (!complaintText) {
        alert("Please enter a customer complaint description or select one of the presets.");
        document.getElementById("complaintText").focus();
        return;
    }

    // Toggle Loading Spinners
    const btn = document.getElementById("btnAnalyze");
    const spinner = document.getElementById("analyzeSpinner");
    const icon = document.getElementById("analyzeIcon");
    btn.disabled = true;
    spinner.classList.remove("d-none");
    icon.classList.add("d-none");

    const startTime = performance.now();

    try {
        let result = null;

        // Try Live Backend if online or mode is 'live'/'auto'
        if ((AppState.mode === "live" || AppState.mode === "auto") && AppState.isBackendOnline) {
            try {
                const response = await fetch(`${AppState.backendUrl}/api/classify`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        text: complaintText,
                        customer: customerName
                    })
                });

                if (response.ok) {
                    result = await response.json();
                }
            } catch (networkErr) {
                console.warn("Backend error, falling back to browser inference:", networkErr);
            }
        }

        // Fallback to Intelligent Browser NLP Engine
        if (!result) {
            // Simulated Deep Learning transformer forward pass
            await new Promise(r => setTimeout(r, 450));
            result = simulateBrowserInference(complaintText, customerName);
        }

        const endTime = performance.now();
        const duration = Math.round(endTime - startTime);

        // Render Results
        displayAnalysisResults(result, duration);

    } catch (error) {
        console.error("Inference failed:", error);
        alert("An error occurred during classification. Check console for details.");
    } finally {
        btn.disabled = false;
        spinner.classList.add("d-none");
        icon.classList.remove("d-none");
    }
}

// Realistic Browser-based Deep Learning Simulation Pipeline
function simulateBrowserInference(text, customer) {
    const lower = text.toLowerCase();

    // Scoring weights for transformer emulation
    let scores = {
        "Billing & Payment": 0.05,
        "Logistics & Delivery": 0.05,
        "Account & Security": 0.05,
        "Product Defects": 0.05,
        "Customer Service": 0.05,
        "Technical & App Bugs": 0.05
    };

    // Keyword heuristics to emulate fine-tuned BERT attention
    if (lower.includes("bill") || lower.includes("charge") || lower.includes("refund") || lower.includes("card") || lower.includes("invoice") || lower.includes("price") || lower.includes("$")) {
        scores["Billing & Payment"] += 0.85;
    }
    if (lower.includes("deliver") || lower.includes("ship") || lower.includes("package") || lower.includes("tracking") || lower.includes("courier") || lower.includes("transit") || lower.includes("late")) {
        scores["Logistics & Delivery"] += 0.85;
    }
    if (lower.includes("security") || lower.includes("unauthorized") || lower.includes("freeze") || lower.includes("hacked") || lower.includes("password") || lower.includes("fraud") || lower.includes("compromised")) {
        scores["Account & Security"] += 0.92;
    }
    if (lower.includes("defect") || lower.includes("broken") || lower.includes("damaged") || lower.includes("shattered") || lower.includes("hardware") || lower.includes("screen") || lower.includes("laptop") || lower.includes("flicker")) {
        scores["Product Defects"] += 0.80;
    }
    if (lower.includes("agent") || lower.includes("rude") || lower.includes("representative") || lower.includes("call") || lower.includes("hung up") || lower.includes("hold") || lower.includes("disrespectful")) {
        scores["Customer Service"] += 0.75;
    }
    if (lower.includes("app") || lower.includes("crash") || lower.includes("error") || lower.includes("bug") || lower.includes("500") || lower.includes("checkout") || lower.includes("ios") || lower.includes("android")) {
        scores["Technical & App Bugs"] += 0.85;
    }

    // Softmax normalization
    const expScores = {};
    let sumExp = 0;
    for (const [cat, val] of Object.entries(scores)) {
        expScores[cat] = Math.exp(val * 2.5);
        sumExp += expScores[cat];
    }

    const probabilities = [];
    for (const [cat, expVal] of Object.entries(expScores)) {
        probabilities.push({
            category: cat,
            probability: parseFloat((expVal / sumExp).toFixed(4))
        });
    }

    // Sort descending
    probabilities.sort((a, b) => b.probability - a.probability);

    const primaryCategory = probabilities[0].category;
    const confidence = probabilities[0].probability;

    // Urgency & SLA Detection
    let urgency = "Medium";
    let slaHours = 24;
    let urgencyClass = "warning";
    let sentiment = "Negative";

    if (primaryCategory === "Account & Security" || lower.includes("urgent") || lower.includes("fraud") || lower.includes("freeze") || lower.includes("critical")) {
        urgency = "Critical (P1)";
        slaHours = 2;
        urgencyClass = "danger";
        sentiment = "High Escalation Risk";
    } else if (confidence > 0.85 && (lower.includes("shattered") || lower.includes("charged twice") || lower.includes("demand"))) {
        urgency = "High (P2)";
        slaHours = 6;
        urgencyClass = "danger";
        sentiment = "Highly Frustrated";
    } else if (lower.includes("disappointed") || lower.includes("late") || lower.includes("delayed")) {
        urgency = "Medium (P3)";
        slaHours = 24;
        urgencyClass = "warning";
        sentiment = "Moderately Dissatisfied";
    } else {
        urgency = "Low (P4)";
        slaHours = 48;
        urgencyClass = "info";
        sentiment = "Neutral / Inquisitive";
    }

    // Extract Entities
    const entities = [];
    const orderMatch = text.match(/(#?[A-Z]{2,4}-?\d{4,8}|order\s*#?\d+)/i);
    if (orderMatch) entities.push({ label: "Order/Ref ID", value: orderMatch[0] });

    const moneyMatch = text.match(/\$\s?\d+(\.\d{2})?/g);
    if (moneyMatch) entities.push({ label: "Amount Quoted", value: moneyMatch.join(", ") });

    const dateMatch = text.match(/(monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d{1,2}(st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec))/i);
    if (dateMatch) entities.push({ label: "Date Mentioned", value: dateMatch[0] });

    const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    if (emailMatch) entities.push({ label: "Email Contact", value: emailMatch[0] });

    if (entities.length === 0) {
        entities.push({ label: "Entity Status", value: "No explicit Order ID found" });
    }

    // Generate Resolution Steps and Email Draft
    const resolution = generateResolutionDetails(primaryCategory, urgency, entities, customer);

    return {
        id: "TKT-" + Math.floor(1000 + Math.random() * 9000),
        customer: customer,
        complaint: text,
        category: primaryCategory,
        confidence: confidence,
        probabilities: probabilities,
        urgency: urgency,
        slaHours: slaHours,
        urgencyClass: urgencyClass,
        sentiment: sentiment,
        entities: entities,
        actionSteps: resolution.steps,
        emailDraft: resolution.emailDraft,
        timestamp: new Date().toISOString()
    };
}

// Automated Resolution Generation Knowledge-Base
function generateResolutionDetails(category, urgency, entities, customer) {
    const custFirst = customer.split(" ")[0].replace(/[^a-zA-Z]/g, "") || "Valued Customer";
    const refId = entities.find(e => e.label.includes("Order") || e.label.includes("Ref"))?.value || "your referenced transaction";

    let steps = [];
    let draft = "";

    switch (category) {
        case "Billing & Payment":
            steps = [
                "Locate billing gateway ledger and match reference number against payment gateway logs.",
                "Verify duplicate charge capture status within Merchant Center (Stripe/PayPal/Razorpay).",
                "Execute automatic credit reversal (typically settles in 3-5 business banking days).",
                "Dispatch official payment reversal receipt and credit notification to customer."
            ];
            draft = `Dear ${custFirst},\n\nThank you for bringing this payment issue to our attention. We sincerely apologize for the inconvenience caused by the billing discrepancy for ${refId}.\n\nOur billing audit team has investigated your transaction and verified the duplicate debit. We have immediately initiated a full refund of the excess charge. You should see this credited to your original payment method within 3 to 5 business days.\n\nTransaction Reversal Reference: REV-${Math.floor(100000 + Math.random() * 900000)}\n\nPlease feel free to reply directly to this email if you have any questions.\n\nWarm regards,\nCustomer Resolution Services`;
            break;

        case "Logistics & Delivery":
            steps = [
                "Cross-reference courier tracking API to determine last recorded transit checkpoint.",
                "File immediate courier damage and transit delay claim with warehouse dispatch team.",
                "Dispatch priority replacement unit via Next-Day Air express shipping at zero cost.",
                "Issue customer a $15 apology goodwill credit voucher for their next order."
            ];
            draft = `Dear ${custFirst},\n\nWe are deeply sorry to hear about the damaged state and delay regarding your delivery (${refId}). We hold our logistics partners to high standards and apologize that this shipment fell short.\n\nWe have expedited a brand-new replacement package for you via Priority Overnight Shipping at no extra cost. Your new tracking number will be emailed to you shortly.\n\nAs a sincere token of our apology, we have also credited a 15% discount voucher to your account for future purchases.\n\nSincerely,\nLogistics & Fulfillment Team`;
            break;

        case "Account & Security":
            steps = [
                "IMMEDIATELY initiate temporary security freeze on customer account credentials.",
                "Terminate all active OAuth login sessions across web and mobile endpoints.",
                "Quarantine pending unauthorized transactions and notify fraud prevention team.",
                "Send verified password reset token via secondary 2FA channel (verified SMS/Email)."
            ];
            draft = `URGENT SECURITY NOTICE\n\nDear ${custFirst},\n\nWe received your report regarding unauthorized activity on your account. As a critical protective measure, our Security Operations team has immediately locked your account and terminated all unauthorized active sessions.\n\nAny unauthorized pending charges have been quarantined for fraud review and will not be settled.\n\nTo safely regain access to your account with two-factor authentication, please follow the secure link sent to your registered contact.\n\nBest regards,\nInformation Security & Trust Team`;
            break;

        case "Product Defects":
            steps = [
                "Override standard return lock to authorize emergency Replacement RMA.",
                "Generate pre-paid expedited return shipping label for the defective unit.",
                "Forward diagnostic error details to Quality Assurance and Hardware Engineering.",
                "Offer customer choice of immediate brand-new replacement or 100% store credit."
            ];
            draft = `Dear ${custFirst},\n\nWe apologize that your item did not perform to the expected quality standards. We understand how frustrating it is when a new product has hardware issues.\n\nWe have waived the return restriction and approved an immediate Return Merchandise Authorization (RMA #${Math.floor(10000 + Math.random() * 90000)}).\n\nAttached is a pre-paid shipping label. You may drop off the package at any nearby courier depot, and your new replacement unit will ship the moment the parcel is scanned.\n\nRegards,\nProduct Quality Support`;
            break;

        case "Customer Service":
            steps = [
                "Retrieve and archive voice call recording / chat transcript for supervisor audit.",
                "Schedule coaching and compliance review with the concerned support representative.",
                "Senior escalation manager to place direct follow-up courtesy phone call to customer.",
                "Apply loyalty goodwill compensation to customer profile."
            ];
            draft = `Dear ${custFirst},\n\nThank you for sharing your feedback regarding your recent interaction with our support team. We take professional conduct very seriously, and we are disappointed to learn that your experience was less than courteous.\n\nOur service quality managers are actively reviewing the communication logs and addressing this with the staff involved. We appreciate your patience, and our senior resolution lead would like to personally ensure your underlying concern is resolved.\n\nWarm regards,\nHead of Customer Experience`;
            break;

        default:
            steps = [
                "Review application crash telemetry and API gateway server logs.",
                "Replicate frontend bug in staging environment across target OS versions.",
                "Reconcile pending payment status with payment gateway webhook listener.",
                "Deploy hotfix patch and notify user once transaction reconciles."
            ];
            draft = `Dear ${custFirst},\n\nThank you for alerting us to the technical issue encountered during checkout (${refId}). Our software engineering team has identified the root cause and is pushing an update.\n\nWe have verified your payment deduction and can confirm your order has now been manually approved and placed into fulfillment.\n\nSincerely,\nTechnical Operations Team`;
            break;
    }

    return { steps, emailDraft: draft };
}

// Display Analysis Results in UI
function displayAnalysisResults(result, durationMs) {
    AppState.currentResult = result;

    document.getElementById("emptyResultState").classList.add("d-none");
    const resultsContent = document.getElementById("resultsContent");
    resultsContent.classList.remove("d-none");

    document.getElementById("modelInferenceTime").innerText = `Inference: ${durationMs}ms | BERT Softmax`;

    // Category Card
    document.getElementById("resCategory").innerText = result.category;
    document.getElementById("resCategoryConfidence").innerText = `Confidence: ${(result.confidence * 100).toFixed(1)}%`;

    // Urgency Card
    const urgencyCard = document.getElementById("urgencyCard");
    const resUrgency = document.getElementById("resUrgency");
    const resSlaTime = document.getElementById("resSlaTime");
    resUrgency.innerText = result.urgency;
    resSlaTime.innerHTML = `<i class="bi bi-clock me-1"></i>SLA: Within ${result.slaHours} Hours`;

    if (result.urgency.includes("Critical")) {
        urgencyCard.className = "result-metric-card p-3 rounded-3 bg-danger bg-opacity-10 border border-danger border-opacity-25";
        resUrgency.className = "fs-5 fw-bold text-danger mt-1";
    } else if (result.urgency.includes("High")) {
        urgencyCard.className = "result-metric-card p-3 rounded-3 bg-danger bg-opacity-10 border border-danger border-opacity-25";
        resUrgency.className = "fs-5 fw-bold text-danger mt-1";
    } else {
        urgencyCard.className = "result-metric-card p-3 rounded-3 bg-warning bg-opacity-10 border border-warning border-opacity-25";
        resUrgency.className = "fs-5 fw-bold text-warning-emphasis mt-1";
    }

    // Sentiment
    document.getElementById("resSentiment").innerText = result.sentiment;

    // Probability Bars
    const probContainer = document.getElementById("probabilityBars");
    probContainer.innerHTML = "";
    result.probabilities.forEach(p => {
        const pct = (p.probability * 100).toFixed(1);
        const barColor = p.category === result.category ? "bg-primary" : "bg-secondary";
        const row = document.createElement("div");
        row.className = "prob-bar-container";
        row.innerHTML = `
            <div class="prob-label small text-truncate" title="${p.category}">${p.category}</div>
            <div class="prob-bar-wrapper">
                <div class="prob-bar-fill ${barColor}" style="width: ${pct}%"></div>
            </div>
            <div class="prob-value small">${pct}%</div>
        `;
        probContainer.appendChild(row);
    });

    // Extracted Entities
    const entityContainer = document.getElementById("extractedEntities");
    entityContainer.innerHTML = "";
    result.entities.forEach(ent => {
        const pill = document.createElement("span");
        pill.className = "entity-pill";
        pill.innerHTML = `<strong>${ent.label}:</strong> ${ent.value}`;
        entityContainer.appendChild(pill);
    });

    // Action Steps
    const stepsList = document.getElementById("resActionSteps");
    stepsList.innerHTML = "";
    result.actionSteps.forEach(step => {
        const li = document.createElement("li");
        li.innerText = step;
        stepsList.appendChild(li);
    });

    // Email Draft
    const emailDiv = document.getElementById("resEmailDraft");
    emailDiv.innerText = result.emailDraft;

    // Scroll slightly so user sees results smoothly
    resultsContent.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

// Copy Email Draft to Clipboard
function copyResolutionDraft() {
    const text = document.getElementById("resEmailDraft").innerText;
    navigator.clipboard.writeText(text).then(() => {
        alert("Customer resolution email copied to clipboard!");
    }).catch(() => {
        alert("Copied!");
    });
}

// Save Current Result as Ticket
function saveAsTicket() {
    if (!AppState.currentResult) {
        alert("No classified complaint to save.");
        return;
    }

    const newTicket = {
        id: AppState.currentResult.id,
        customer: AppState.currentResult.customer,
        category: AppState.currentResult.category,
        complaint: AppState.currentResult.complaint,
        confidence: AppState.currentResult.confidence,
        urgency: AppState.currentResult.urgency,
        status: "Open",
        slaHours: AppState.currentResult.slaHours,
        actionSteps: AppState.currentResult.actionSteps,
        emailDraft: AppState.currentResult.emailDraft,
        timestamp: new Date().toLocaleDateString() + " " + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    AppState.tickets.unshift(newTicket);
    saveTicketsToStorage();
    renderTicketsTable();
    updateChartMetrics();

    alert(`Ticket #${newTicket.id} created and dispatched to Triage Queue!`);
    window.location.hash = "#tickets-section";
}

// LocalStorage Persistence
function saveTicketsToStorage() {
    localStorage.setItem("resolveai_tickets", JSON.stringify(AppState.tickets));
}

function loadTicketsFromStorage() {
    const stored = localStorage.getItem("resolveai_tickets");
    if (stored) {
        try {
            AppState.tickets = JSON.parse(stored);
        } catch (e) {
            AppState.tickets = getDefaultTickets();
        }
    } else {
        AppState.tickets = getDefaultTickets();
        saveTicketsToStorage();
    }
}

// Default Seed Tickets for first-time visitors / demo
function getDefaultTickets() {
    return [
        {
            id: "TKT-1042",
            customer: "Johnathan Davis",
            category: "Billing & Payment",
            complaint: "Overcharged $89 for renewal without advance notification email.",
            confidence: 0.942,
            urgency: "High (P2)",
            status: "In Progress",
            slaHours: 6,
            actionSteps: ["Verify subscription billing history", "Issue credit memo"],
            emailDraft: "Dear Jonathan, we are processing your renewal refund...",
            timestamp: "Today, 10:30 AM"
        },
        {
            id: "TKT-1041",
            customer: "Elena Rostova",
            category: "Account & Security",
            complaint: "Suspicious login alert from unrecognized browser in Singapore.",
            confidence: 0.978,
            urgency: "Critical (P1)",
            status: "Open",
            slaHours: 2,
            actionSteps: ["Lock compromised session", "Trigger 2FA re-verification"],
            emailDraft: "Dear Elena, we have temporarily secured your account...",
            timestamp: "Today, 11:15 AM"
        },
        {
            id: "TKT-1040",
            customer: "Carlos Santana",
            category: "Logistics & Delivery",
            complaint: "Shipment marked as delivered but parcel missing from mailbox.",
            confidence: 0.925,
            urgency: "Medium (P3)",
            status: "Resolved",
            slaHours: 24,
            actionSteps: ["Investigate courier GPS coordinates", "Deliver replacement"],
            emailDraft: "Dear Carlos, your replacement parcel has been delivered...",
            timestamp: "Yesterday, 04:20 PM"
        },
        {
            id: "TKT-1039",
            customer: "Pooja Patel",
            category: "Technical & App Bugs",
            complaint: "App freezes continuously on payment confirmation screen on Android 14.",
            confidence: 0.934,
            urgency: "Medium (P3)",
            status: "Open",
            slaHours: 24,
            actionSteps: ["Inspect log trace", "Reconcile payment"],
            emailDraft: "Dear Pooja, we have resolved your checkout record...",
            timestamp: "Yesterday, 01:10 PM"
        }
    ];
}

// Render Tickets Table
function renderTicketsTable(filteredList = null) {
    const list = filteredList || AppState.tickets;
    const tbody = document.getElementById("ticketsTableBody");
    const emptyMsg = document.getElementById("noTicketsMessage");

    tbody.innerHTML = "";

    if (list.length === 0) {
        emptyMsg.classList.remove("d-none");
        return;
    }
    emptyMsg.classList.add("d-none");

    list.forEach(t => {
        const tr = document.createElement("tr");

        // Priority badge style
        let priorityBadge = "bg-warning text-dark";
        if (t.urgency.includes("Critical") || t.urgency.includes("P1")) priorityBadge = "bg-danger";
        else if (t.urgency.includes("High") || t.urgency.includes("P2")) priorityBadge = "bg-danger bg-opacity-75 text-white";
        else if (t.urgency.includes("Low") || t.urgency.includes("P4")) priorityBadge = "bg-info text-dark";

        // Status badge style
        let statusBadge = "bg-primary";
        if (t.status === "Resolved") statusBadge = "bg-success";
        else if (t.status === "In Progress") statusBadge = "bg-warning text-dark";

        tr.innerHTML = `
            <td><span class="font-monospace fw-bold text-primary">${t.id}</span></td>
            <td><strong>${t.customer}</strong><br><small class="text-muted">${t.timestamp}</small></td>
            <td><span class="badge bg-light text-dark border">${t.category}</span></td>
            <td class="small" style="max-width: 280px;"><div class="text-truncate" title="${t.complaint}">${t.complaint}</div></td>
            <td><span class="small font-monospace">${(t.confidence * 100).toFixed(1)}%</span></td>
            <td><span class="badge ${priorityBadge}">${t.urgency}</span></td>
            <td><span class="badge ${statusBadge}">${t.status}</span></td>
            <td class="text-end">
                <button class="btn btn-xs btn-outline-primary rounded-pill me-1" onclick="viewTicketModal('${t.id}')">
                    <i class="bi bi-eye"></i> Details
                </button>
                <button class="btn btn-xs ${t.status === 'Resolved' ? 'btn-outline-secondary' : 'btn-outline-success'} rounded-pill" onclick="toggleTicketStatus('${t.id}')">
                    ${t.status === 'Resolved' ? '<i class="bi bi-arrow-counterclockwise"></i> Reopen' : '<i class="bi bi-check-lg"></i> Resolve'}
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    document.getElementById("kpiTotal").innerText = (1480 + AppState.tickets.length).toLocaleString();
}

// Filter Tickets
function filterTickets() {
    const search = document.getElementById("ticketSearchInput").value.toLowerCase();
    const cat = document.getElementById("filterCategory").value;
    const status = document.getElementById("filterStatus").value;
    const urgency = document.getElementById("filterUrgency").value;

    const filtered = AppState.tickets.filter(t => {
        const matchesSearch = t.customer.toLowerCase().includes(search) ||
                              t.id.toLowerCase().includes(search) ||
                              t.complaint.toLowerCase().includes(search);
        const matchesCat = (cat === "ALL" || t.category === cat);
        const matchesStatus = (status === "ALL" || t.status === status);
        const matchesUrgency = (urgency === "ALL" || t.urgency.includes(urgency));

        return matchesSearch && matchesCat && matchesStatus && matchesUrgency;
    });

    renderTicketsTable(filtered);
}

// Toggle Ticket Status
function toggleTicketStatus(ticketId) {
    const ticket = AppState.tickets.find(t => t.id === ticketId);
    if (!ticket) return;

    ticket.status = (ticket.status === "Resolved") ? "In Progress" : "Resolved";
    saveTicketsToStorage();
    renderTicketsTable();
    updateChartMetrics();
}

// View Ticket Details Modal
let activeModalTicketId = null;
function viewTicketModal(ticketId) {
    const ticket = AppState.tickets.find(t => t.id === ticketId);
    if (!ticket) return;

    activeModalTicketId = ticketId;
    document.getElementById("modalTicketId").innerText = ticket.id;
    document.getElementById("modalTicketTitle").innerText = ticket.category;

    const body = document.getElementById("modalTicketBody");
    body.innerHTML = `
        <div class="mb-3">
            <div class="small text-muted fw-bold">CUSTOMER & LOG DATE</div>
            <div class="fw-semibold">${ticket.customer} • <span class="text-muted">${ticket.timestamp}</span></div>
        </div>
        <div class="mb-3">
            <div class="small text-muted fw-bold">CUSTOMER GRIEVANCE</div>
            <div class="p-3 bg-light rounded-3 small font-monospace">${ticket.complaint}</div>
        </div>
        <div class="row g-2 mb-3">
            <div class="col-sm-4">
                <div class="p-2 border rounded-3 small">
                    <span class="text-muted d-block">Confidence:</span>
                    <strong>${(ticket.confidence * 100).toFixed(1)}%</strong>
                </div>
            </div>
            <div class="col-sm-4">
                <div class="p-2 border rounded-3 small">
                    <span class="text-muted d-block">Priority / SLA:</span>
                    <strong>${ticket.urgency} (${ticket.slaHours} hrs)</strong>
                </div>
            </div>
            <div class="col-sm-4">
                <div class="p-2 border rounded-3 small">
                    <span class="text-muted d-block">Status:</span>
                    <strong class="text-primary">${ticket.status}</strong>
                </div>
            </div>
        </div>
        <div class="mb-3">
            <div class="small text-muted fw-bold">AI RESOLUTION EMAIL DRAFT</div>
            <div class="p-3 bg-light rounded-3 small font-monospace border">${ticket.emailDraft || "Standard resolution dispatched."}</div>
        </div>
    `;

    const resolveBtn = document.getElementById("btnModalResolve");
    resolveBtn.innerText = ticket.status === "Resolved" ? "Reopen Ticket" : "Mark as Resolved";
    resolveBtn.className = ticket.status === "Resolved" ? "btn btn-outline-warning rounded-pill" : "btn btn-success rounded-pill";

    const modal = new bootstrap.Modal(document.getElementById("ticketDetailModal"));
    modal.show();
}

function toggleModalTicketStatus() {
    if (!activeModalTicketId) return;
    toggleTicketStatus(activeModalTicketId);
    const modalEl = document.getElementById("ticketDetailModal");
    const modalInstance = bootstrap.Modal.getInstance(modalEl);
    if (modalInstance) modalInstance.hide();
}

// Export Tickets as CSV
function exportTicketsCSV() {
    if (AppState.tickets.length === 0) {
        alert("No tickets available to export.");
        return;
    }

    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Ticket ID,Customer,Category,Confidence,Priority,Status,Timestamp,Complaint\n";

    AppState.tickets.forEach(t => {
        const cleanComplaint = `"${t.complaint.replace(/"/g, '""')}"`;
        const row = [t.id, `"${t.customer}"`, `"${t.category}"`, `${(t.confidence*100).toFixed(1)}%`, `"${t.urgency}"`, t.status, `"${t.timestamp}"`, cleanComplaint];
        csvContent += row.join(",") + "\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `customer_complaints_export_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Clear Tickets
function clearAllTickets() {
    if (confirm("Are you sure you want to clear all tickets from local storage?")) {
        AppState.tickets = [];
        saveTicketsToStorage();
        renderTicketsTable();
        updateChartMetrics();
    }
}

// Send Current Complaint to Copilot for Discussion
function sendToCopilot() {
    if (!AppState.currentResult) return;
    const query = `How should our executive respond to this complaint: "${AppState.currentResult.complaint.substring(0, 100)}..."?`;
    sendCopilotPreset(query);
    window.location.hash = "#copilot-section";
}

// Copilot Chat Handler
function sendCopilotPreset(query) {
    document.getElementById("copilotInput").value = query;
    handleCopilotSubmit(new Event("submit"));
}

function handleCopilotSubmit(e) {
    e.preventDefault();
    const input = document.getElementById("copilotInput");
    const query = input.value.trim();
    if (!query) return;

    const chatBox = document.getElementById("copilotChatBox");

    // Append User Message
    const userMsg = document.createElement("div");
    userMsg.className = "d-flex justify-content-end mb-3";
    userMsg.innerHTML = `<div class="chat-bubble-user">${query}</div>`;
    chatBox.appendChild(userMsg);
    input.value = "";
    chatBox.scrollTop = chatBox.scrollHeight;

    // Simulate Bot Response
    setTimeout(() => {
        const botResponseText = generateCopilotAnswer(query);
        const botMsg = document.createElement("div");
        botMsg.className = "d-flex gap-2 mb-3";
        botMsg.innerHTML = `
            <div class="bg-primary text-white rounded-circle p-2 align-self-start" style="width:34px;height:34px;display:flex;align-items:center;justify-content:center;">
                <i class="bi bi-robot small"></i>
            </div>
            <div class="chat-bubble-bot">
                <div class="fw-bold small text-primary mb-1">ResolveAI Copilot</div>
                <div class="small">${botResponseText}</div>
            </div>
        `;
        chatBox.appendChild(botMsg);
        chatBox.scrollTop = chatBox.scrollHeight;
    }, 400);
}

function generateCopilotAnswer(prompt) {
    const p = prompt.toLowerCase();
    if (p.includes("billing") || p.includes("double") || p.includes("charge")) {
        return "<strong>Recommended SOP for Billing Inquiries:</strong><br>1. Check Stripe/Razorpay charge IDs to identify dual-authorized authorization holds.<br>2. If second debit is a pre-auth hold, reassure the customer that banks release it automatically in 3 business days.<br>3. If captured twice, click <em>'Dispatch & Log Ticket'</em> to auto-trigger the reversal refund protocol.";
    }
    if (p.includes("delivery") || p.includes("voucher") || p.includes("late")) {
        return "<strong>Apology Script with Compensation:</strong><br><em>'Dear Customer, we sincerely apologize for the delay. Your package is on priority expedited route. To make this right, we have credited a 20% discount code [RESOLVE20] to your profile.'</em>";
    }
    if (p.includes("security") || p.includes("takeover") || p.includes("fraud")) {
        return "<strong>Critical Security Protocol:</strong><br>1. Lock user auth token immediately via Admin Console.<br>2. Invalidate password hashes.<br>3. Require government ID / KYC verification before unlocking email recovery.";
    }
    return "<strong>Copilot Suggestion:</strong><br>Based on historical resolution data, addressing the customer's sentiment with an empathetic opening statement reduces escalation likelihood by 48%. Use the automated email draft above or customize with the customer's explicit Order ID.";
}

// Chart.js Visualizations
function initCharts() {
    // 1. Category Distribution
    const catCtx = document.getElementById("categoryChart").getContext("2d");
    AppState.charts.category = new Chart(catCtx, {
        type: "doughnut",
        data: {
            labels: ["Billing", "Logistics", "Security", "Product", "Service", "Tech"],
            datasets: [{
                data: [38, 29, 12, 14, 8, 9],
                backgroundColor: ["#2563eb", "#06b6d4", "#dc2626", "#d97706", "#64748b", "#7c3aed"],
                borderWidth: 2,
                borderColor: "#ffffff"
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: "bottom", labels: { boxWidth: 12, font: { size: 11 } } }
            }
        }
    });

    // 2. Weekly Trend Line Chart
    const trendCtx = document.getElementById("trendChart").getContext("2d");
    AppState.charts.trend = new Chart(trendCtx, {
        type: "line",
        data: {
            labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
            datasets: [
                {
                    label: "Inflow",
                    data: [42, 58, 65, 50, 72, 38, 30],
                    borderColor: "#3b82f6",
                    backgroundColor: "rgba(59, 130, 246, 0.1)",
                    fill: true,
                    tension: 0.3
                },
                {
                    label: "AI Resolved",
                    data: [39, 54, 61, 48, 68, 36, 29],
                    borderColor: "#10b981",
                    backgroundColor: "transparent",
                    borderDash: [5, 5],
                    tension: 0.3
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: "top", labels: { boxWidth: 12, font: { size: 11 } } }
            },
            scales: {
                y: { beginAtZero: true, grid: { color: "#f1f5f9" } },
                x: { grid: { display: false } }
            }
        }
    });

    // 3. Priority Bar Chart
    const priCtx = document.getElementById("priorityChart").getContext("2d");
    AppState.charts.priority = new Chart(priCtx, {
        type: "bar",
        data: {
            labels: ["P1 Crit", "P2 High", "P3 Med", "P4 Low"],
            datasets: [{
                label: "Tickets",
                data: [18, 34, 52, 26],
                backgroundColor: ["#dc2626", "#ea580c", "#eab308", "#0284c7"],
                borderRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, grid: { color: "#f1f5f9" } },
                x: { grid: { display: false } }
            }
        }
    });
}

function refreshDashboardMetrics() {
    updateChartMetrics();
    alert("Dashboard analytics synchronized successfully!");
}

function updateChartMetrics() {
    // Dynamic recalculation for active tickets
    let crit = 0;
    AppState.tickets.forEach(t => {
        if (t.urgency.includes("Critical") || t.urgency.includes("P1")) crit++;
    });
    document.getElementById("kpiCritical").innerText = (28 + crit);
}
