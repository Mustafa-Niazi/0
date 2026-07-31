// ==========================================
// 1. تحديد العناصر الرئيسية في الصفحة
// ==========================================
const mainForm = document.getElementById("mainForm");
const saveBtn = document.getElementById("saveBtn");
const printBtn = document.getElementById("printBtn");
const wordBtn = document.getElementById("wordBtn");

const savedCopiesHeading = document.getElementById("savedCopiesHeading");
const savedCopiesContainer = document.getElementById("savedCopies");

// Modals
const saveModal = document.getElementById("saveModal");
const btnSaveAndReset = document.getElementById("btnSaveAndReset");
const btnSaveOnly = document.getElementById("btnSaveOnly");
const btnSaveCancel = document.getElementById("btnSaveCancel");
const btnCloseSaveModal = document.getElementById("btnCloseSaveModal");

const deleteModal = document.getElementById("deleteModal");
const btnDeleteConfirm = document.getElementById("btnDeleteConfirm");
const btnDeleteCancel = document.getElementById("btnDeleteCancel");
const btnCloseDeleteModal = document.getElementById("btnCloseDeleteModal");

let pendingDeleteData = null;
let copies = [];

// ==========================================
// 2. الحسابات التلقائية للجدول
// ==========================================
function calculateTotals(container = mainForm) {
    if (!container) return;
    const item1 = parseFloat(container.querySelector('[data-key="item1"]')?.value) || 0;
    const item2 = parseFloat(container.querySelector('[data-key="item2"]')?.value) || 0;
    const item3 = parseFloat(container.querySelector('[data-key="item3"]')?.value) || 0;

    const total = item1 + item2 + item3;
    const vat = total * 0.14; 
    const grandtotal = total + vat;

    const totalInput = container.querySelector('[data-key="total"]');
    const vatInput = container.querySelector('[data-key="vat"]');
    const grandtotalInput = container.querySelector('[data-key="grandtotal"]');

    if (totalInput) totalInput.value = total ? total.toFixed(2) : "";
    if (vatInput) vatInput.value = vat ? vat.toFixed(2) : "";
    if (grandtotalInput) grandtotalInput.value = grandtotal ? grandtotal.toFixed(2) : "";
}

if (mainForm) {
    mainForm.addEventListener("input", (e) => {
        if (e.target.matches('[data-key="item1"], [data-key="item2"], [data-key="item3"]')) {
            calculateTotals(mainForm);
        }
    });
}

// ==========================================
// 3. تسلسل وتبديل قيم النموذج
// ==========================================
function serializeForm(container) {
    const data = {};
    const inputs = container.querySelectorAll("[data-key]");
    inputs.forEach((input) => {
        const key = input.getAttribute("data-key");
        if (input.type === "checkbox") {
            data[key] = input.checked;
        } else {
            data[key] = input.value;
        }
    });
    return data;
}

function deserializeForm(container, data) {
    Object.keys(data).forEach((key) => {
        const input = container.querySelector(`[data-key="${key}"]`);
        if (input) {
            if (input.type === "checkbox") {
                input.checked = Boolean(data[key]);
            } else {
                input.value = data[key] || "";
            }
        }
    });
    calculateTotals(container);
}

function clearMainForm() {
    if (!mainForm) return;
    const inputs = mainForm.querySelectorAll("[data-key]");
    inputs.forEach((input) => {
        if (input.type === "checkbox") {
            input.checked = false;
        } else if (!input.hasAttribute("readonly")) {
            input.value = "";
        }
    });
    calculateTotals(mainForm);
}

// ==========================================
// 4. تصدير عنصر محدد إلى Word
// ==========================================
function exportToWord(element) {
    const header = "<html xmlns:o='urn:schemas-microsoft-com:office:office' "+
        "xmlns:w='urn:schemas-microsoft-com:office:word' "+
        "xmlns='http://www.w3.org/TR/REC-html40'>"+
        "<head><meta charset='utf-8'><title>Export HTML to Word</title></head><body>";
    const footer = "</body></html>";
    const sourceHTML = header + element.innerHTML + footer;
    
    const source = 'data:application/vnd.ms-word;charset=utf-8,' + encodeURIComponent(sourceHTML);
    const fileDownload = document.createElement("a");
    document.body.appendChild(fileDownload);
    fileDownload.href = source;
    fileDownload.download = 'نموذج_سداد_تأمينات.doc';
    fileDownload.click();
    document.body.removeChild(fileDownload);
}

// ==========================================
// 5. إدارة النسخ المحفوظة وطباعة نسخة منفردة
// ==========================================
function updateSavedHeading() {
    if (savedCopiesHeading) {
        savedCopiesHeading.style.display = copies.length > 0 ? "block" : "none";
    }
}

function persistCopies() {
    localStorage.setItem("insurance_form_copies", JSON.stringify(copies));
}

function loadCopies() {
    const stored = localStorage.getItem("insurance_form_copies");
    if (stored) {
        try {
            copies = JSON.parse(stored);
            copies.forEach((copy) => renderCopy(copy));
            updateSavedHeading();
        } catch (e) {
            console.error("خطأ في تحميل النسخ المحفوظة", e);
        }
    }
}

function printSingleElement(targetElement) {
    document.querySelectorAll('.print-target').forEach(el => el.classList.remove('print-target'));

    targetElement.classList.add("print-target");
    document.body.classList.add("printing-single");
    
    setTimeout(() => {
        window.print();
        document.body.classList.remove("printing-single");
        targetElement.classList.remove("print-target");
    }, 50);
}

function renderCopy(copyData) {
    if (!mainForm || !savedCopiesContainer) return;
    const clone = mainForm.cloneNode(true);
    clone.id = `copy-${copyData.id}`;
    clone.setAttribute("data-copy-id", copyData.id);

    deserializeForm(clone, copyData.values);

    const controls = clone.querySelector(".controls");
    if (controls) {
        controls.innerHTML = `
            <button type="button" class="btn-copy-print">طباعة هذه النسخة</button>
            <button type="button" class="btn-copy-word">تصدير Word</button>
            <button type="button" class="btn-copy-delete btn-danger">حذف النسخة</button>
        `;

        controls.querySelector(".btn-copy-print").addEventListener("click", () => {
            printSingleElement(clone);
        });

        controls.querySelector(".btn-copy-word").addEventListener("click", () => {
            exportToWord(clone);
        });

        controls.querySelector(".btn-copy-delete").addEventListener("click", () => {
            pendingDeleteData = { copyId: copyData.id, wrapperEl: clone };
            if (deleteModal) deleteModal.style.display = "flex";
        });
    }

    setupDigitAutoTab(clone);
    savedCopiesContainer.appendChild(clone);
}

// ==========================================
// 6. أحداث الـ Modals والأزرار الرئيسية
// ==========================================
if (saveBtn) {
    saveBtn.addEventListener("click", () => {
        if (saveModal) saveModal.style.display = "flex";
    });
}

function executeSave(shouldClear) {
    const copyData = {
        id: Date.now(),
        label: `نسخة محفوظة بتاريخ ${new Date().toLocaleDateString("ar-EG")}`,
        values: serializeForm(mainForm),
    };
    copies.push(copyData);
    persistCopies();
    renderCopy(copyData);
    updateSavedHeading();

    if (shouldClear) {
        clearMainForm();
    }

    if (saveModal) saveModal.style.display = "none";
}

if (btnSaveAndReset) btnSaveAndReset.addEventListener("click", () => executeSave(true));
if (btnSaveOnly) btnSaveOnly.addEventListener("click", () => executeSave(false));

const closeSaveAction = () => { if (saveModal) saveModal.style.display = "none"; };
if (btnSaveCancel) btnSaveCancel.addEventListener("click", closeSaveAction);
if (btnCloseSaveModal) btnCloseSaveModal.addEventListener("click", closeSaveAction);

if (btnDeleteConfirm) {
    btnDeleteConfirm.addEventListener("click", () => {
        if (pendingDeleteData) {
            const { copyId, wrapperEl } = pendingDeleteData;
            copies = copies.filter((c) => c.id !== copyId);
            persistCopies();
            wrapperEl.remove();
            updateSavedHeading();
            pendingDeleteData = null;
        }
        if (deleteModal) deleteModal.style.display = "none";
    });
}

const closeDeleteAction = () => {
    pendingDeleteData = null;
    if (deleteModal) deleteModal.style.display = "none";
};

if (btnDeleteCancel) btnDeleteCancel.addEventListener("click", closeDeleteAction);
if (btnCloseDeleteModal) btnCloseDeleteModal.addEventListener("click", closeDeleteAction);

if (printBtn) {
    printBtn.addEventListener("click", () => printSingleElement(mainForm));
}

if (wordBtn) {
    wordBtn.addEventListener("click", () => exportToWord(mainForm));
}

// ==========================================
// 7. خانات التاريخ: التنقل التلقائي بين الخانات
// ==========================================
function setupDigitAutoTab(root = document) {
    root.querySelectorAll(".date, .date-inputs").forEach((group) => {
        const boxes = Array.from(group.querySelectorAll('input[maxlength="1"]'));
        
        boxes.forEach((box, idx) => {
            box.addEventListener("input", () => {
                box.value = box.value.slice(-1);
                if (box.value === "") return;

                const nextBox = boxes[idx + 1]; // الخانة على الشمال
                const prevBox = boxes[idx - 1]; // الخانة على اليمين

                // 1. كتابة من اليمين للشمال والخانة الشمال فاضية -> كمل شمال
                if (nextBox && nextBox.value === "") {
                    nextBox.focus();
                    nextBox.select();
                } 
                // 2. كتابة من الشمال لليمين والخانة اليمين فاضية -> كمل يمين
                else if (prevBox && prevBox.value === "") {
                    prevBox.focus();
                    prevBox.select();
                }
                // 3. الخانتين مليانين -> اتجه شمال افتراضياً
                else if (nextBox) {
                    nextBox.focus();
                    nextBox.select();
                }
            });

            box.addEventListener("keydown", (e) => {
                // التحكم بـ Backspace
                if (e.key === "Backspace" && box.value === "") {
                    const nextBox = boxes[idx + 1];
                    const prevBox = boxes[idx - 1];
                    
                    if (prevBox && prevBox.value !== "") {
                        prevBox.focus();
                    } else if (nextBox && nextBox.value !== "") {
                        nextBox.focus();
                    } else if (prevBox) {
                        prevBox.focus();
                    }
                }
                
                // أسهم الاتجاهات
                if (e.key === "ArrowLeft" && idx + 1 < boxes.length) {
                    boxes[idx + 1].focus();
                } else if (e.key === "ArrowRight" && idx > 0) {
                    boxes[idx - 1].focus();
                }
            });

            // تحديد المحتوى لتسهيل التعديل المباشر عند الفوكس
            box.addEventListener("focus", () => {
                box.select();
            });
        });
    });
}

// ==========================================
// 8. التشغيل عند تحميل الصفحة
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    loadCopies();
    setupDigitAutoTab(document);
});
