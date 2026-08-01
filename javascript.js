// ==========================================
// 1. تحديد العناصر الرئيسية في الصفحة
// ==========================================
const mainForm = document.getElementById("mainForm");
const saveBtn = document.getElementById("saveBtn");
const printBtn = document.getElementById("printBtn");

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
// 2. الحسابات التلقائية للجدول + وضع التفعيل اليدوي (row3Label)
// ==========================================
function calculateTotals(container = mainForm) {
    if (!container) return;

    // لو row3Label = "تفعيل" يبقى المستخدم بيتحكم يدويًا في الاجمالي/القيمة المضافة/الاجمالي الكلي
    const trigger = container.querySelector('[data-key="row3Label"]');
    if (trigger && trigger.value.trim() === "تفعيل") return;

    const item1 = parseFloat(container.querySelector('[data-key="item1"]')?.value) || 0;
    const item2 = parseFloat(container.querySelector('[data-key="item2"]')?.value) || 0;
    const item3 = parseFloat(container.querySelector('[data-key="item3"]')?.value) || 0;

    const total = item1 + item2 + item3;
    const vat = total * 0.14;
    const grandtotal = total + vat;

    const totalInput = container.querySelector('[data-key="total"]');
    const vatInput = container.querySelector('[data-key="vat"]');
    const grandtotalInput = container.querySelector('[data-key="grandtotal"]');

    if (totalInput) totalInput.value = total ? parseFloat(total.toFixed(2)).toString() : "";
    if (vatInput) vatInput.value = vat ? parseFloat(vat.toFixed(2)).toString() : "";
    if (grandtotalInput) grandtotalInput.value = grandtotal ? parseFloat(grandtotal.toFixed(2)).toString() : "";
}

// نسخة عامة تشتغل على أي container (الفورم الأساسي أو أي نسخة محفوظة)
function setupAutoCalc(container) {
    if (!container) return;
    container.addEventListener("input", (e) => {
        if (e.target.matches('[data-key="item1"], [data-key="item2"], [data-key="item3"]')) {
            calculateTotals(container);
        }
    });
}

// تبديل readonly / قابل للتعديل يدويًا لحقول total/vat/grandtotal حسب row3Label
function setupManualTotalsToggle(container) {
    if (!container) return;
    const trigger = container.querySelector('[data-key="row3Label"]');
    if (!trigger) return;

    const manualFields = ["total", "vat", "grandtotal"]
        .map((k) => container.querySelector(`[data-key="${k}"]`))
        .filter(Boolean);

    const isManualMode = () => trigger.value.trim() === "تفعيل";
    const saveValue = (input) => { input.dataset.savedValue = input.value; };
    const restoreValue = (input) => {
        if (input.dataset.savedValue !== undefined) input.value = input.dataset.savedValue;
    };

    function updateFieldsState() {
        const manual = isManualMode();
        manualFields.forEach((input) => {
            if (manual) {
                restoreValue(input);
                input.removeAttribute("readonly");
                input.classList.add("manual-editable");
            } else {
                saveValue(input);
                input.setAttribute("readonly", "true");
                input.classList.remove("manual-editable");
            }
        });
    }

    manualFields.forEach((input) => {
        input.addEventListener("input", () => {
            if (isManualMode()) saveValue(input);
        });
    });

    trigger.addEventListener("input", updateFieldsState);
    updateFieldsState();
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
    localStorage.removeItem("insurance_main_form_backup");
}

function persistMainForm() {
    if (!mainForm) return;
    const data = serializeForm(mainForm);
    localStorage.setItem("insurance_main_form_backup", JSON.stringify(data));
}

function loadMainFormBackup() {
    if (!mainForm) return;
    const stored = localStorage.getItem("insurance_main_form_backup");
    if (stored) {
        try {
            const data = JSON.parse(stored);
            deserializeForm(mainForm, data);
            setupManualTotalsToggle(mainForm);
        } catch (e) {
            console.error("خطأ في استرجاع الفورم الأساسي", e);
        }
    }
}

// ==========================================
// 4. تصدير مع إمكانية اختيار المكان والاسم (Save As)
// ==========================================
async function saveJsonFile(dataObject, defaultFileName) {
    const jsonString = JSON.stringify(dataObject, null, 2);
    
    if ('showSaveFilePicker' in window) {
        try {
            const handle = await window.showSaveFilePicker({
                suggestedName: defaultFileName,
                types: [{
                    description: 'JSON Files',
                    accept: { 'application/json': ['.json'] },
                }],
            });
            const writable = await handle.createWritable();
            await writable.write(jsonString);
            await writable.close();
            return;
        } catch (err) {
            if (err.name === 'AbortError') return;
            console.error("فشل الحفظ عبر الـ Picker، سيتم استخدام التنزيل العادي", err);
        }
    }

    const blob = new Blob([jsonString], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = defaultFileName;
    a.click();
    URL.revokeObjectURL(a.href);
}

// ==========================================
// 5. تصدير عنصر محدد إلى Word
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
// 6. إدارة النسخ المحفوظة وطباعة نسخة منفردة
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
           
            <button type="button" class="btn-copy-delete btn-danger">حذف النسخة</button>
        `;

        controls.querySelector(".btn-copy-print").addEventListener("click", () => {
            printSingleElement(clone);
        });

      

        controls.querySelector(".btn-copy-delete").addEventListener("click", () => {
            pendingDeleteData = { copyId: copyData.id, wrapperEl: clone };
            if (deleteModal) deleteModal.style.display = "flex";
        });
    }

    setupDigitAutoTab(clone);
    setupDateInputs(clone);
    setupManualTotalsToggle(clone);
    setupAutoCalc(clone);
    
    savedCopiesContainer.appendChild(clone);
    setupMainNumberBackup(clone);
    setupMainMonthBackup(clone); // <-- أضف هذا السطر هنا ليعمل حقل mainMonth في الكلون أيضاً
}
// ==========================================
// 7. أحداث الـ Modals والأزرار الرئيسية
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



// ==========================================
// 8. خانات التاريخ والتنقل التلقائي
// ==========================================
function setupDigitAutoTab(root = document) {
    root.querySelectorAll(".date, .date-inputs").forEach((group) => {
        const boxes = Array.from(group.querySelectorAll('input[maxlength="1"]'));

        boxes.forEach((box, idx) => {
            box.addEventListener("input", () => {
                box.value = box.value.slice(-1);
                if (box.value === "") return;

                const nextBox = boxes[idx + 1];
                const prevBox = boxes[idx - 1];

                if (nextBox && nextBox.value === "") {
                    nextBox.focus();
                    nextBox.select();
                } else if (prevBox && prevBox.value === "") {
                    prevBox.focus();
                    prevBox.select();
                } else if (nextBox) {
                    nextBox.focus();
                    nextBox.select();
                }
            });

            box.addEventListener("keydown", (e) => {
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

                if (e.key === "ArrowLeft" && idx + 1 < boxes.length) {
                    boxes[idx + 1].focus();
                } else if (e.key === "ArrowRight" && idx > 0) {
                    boxes[idx - 1].focus();
                }
            });

            box.addEventListener("focus", () => {
                box.select();
            });
        });
    });
}

function setupDateInputs(root = document) {
    root.querySelectorAll(".date-container").forEach((group) => {
        const boxes = Array.from(group.querySelectorAll('input.date-input'));

        boxes.forEach((box, idx) => {
            const maxLen = parseInt(box.getAttribute("maxlength")) || 2;

            box.addEventListener("input", () => {
                if (box.value.length > maxLen) {
                    box.value = box.value.slice(0, maxLen);
                }
                if (box.value === "") return;

                const nextBox = boxes[idx + 1];
                if (nextBox && box.value.length >= maxLen) {
                    nextBox.focus();
                    nextBox.select();
                }
            });

            box.addEventListener("keydown", (e) => {
                if (e.key === "Backspace" && box.value === "") {
                    const prevBox = boxes[idx - 1];
                    if (prevBox) {
                        prevBox.focus();
                        prevBox.select();
                    }
                }

                if (e.key === "ArrowLeft" && idx + 1 < boxes.length) {
                    boxes[idx + 1].focus();
                } else if (e.key === "ArrowRight" && idx > 0) {
                    boxes[idx - 1].focus();
                }
            });

            box.addEventListener("focus", () => {
                box.select();
            });
        });
    });
}

// ==========================================
// 9. النسخ الاحتياطي الفردي (عبر حقل mainNumber - صفحة واحدة)
// ==========================================
function setupMainNumberBackup(container) {
    if (!container) return;
    const trigger = container.querySelector('[data-key="mainNumber"]');
    if (!trigger) return;

    const oldModals = container.querySelectorAll(".single-backup-modal");
    oldModals.forEach(m => m.remove());

    const backupModal = document.createElement("div");
    backupModal.className = "modal-overlay single-backup-modal";
    backupModal.style.cssText = "display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); justify-content: center; align-items: center; z-index: 1000;";
    backupModal.innerHTML = `
        <div class="modal-box" style="background: #fff; padding: 20px; border-radius: 8px; min-width: 300px; text-align: center; position: relative;">
            <button type="button" class="modal-close-x btn-backup-close" title="إلغاء" style="position: absolute; top: 10px; left: 10px; background: none; border: none; font-size: 20px; cursor: pointer;">×</button>
            <h3>نسخ احتياطي (لهذه الصفحة فقط)</h3>
            <p>اختر الإجراء المطلوب:</p>
            <div class="modal-actions" style="display: flex; gap: 10px; margin-top: 15px;">
                <button type="button" class="btn-modal btn-backup-export" style="flex:1; padding: 8px;">تصدير</button>
                <button type="button" class="btn-modal btn-backup-import" style="flex:1; padding: 8px;">استيراد</button>
                <button type="button" class="btn-modal btn-cancel btn-backup-close" style="flex:1; padding: 8px;">إلغاء</button>
            </div>
        </div>
    `;
    container.appendChild(backupModal);

    backupModal.querySelector(".btn-backup-export").addEventListener("click", async () => {
        const data = serializeForm(container);
        await saveJsonFile(data, `page_backup_${Date.now()}.json`);
        backupModal.style.display = "none";
        trigger.value = "";
    });

    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = ".json";
    fileInput.style.display = "none";
    container.appendChild(fileInput);

    backupModal.querySelector(".btn-backup-import").addEventListener("click", () => {
        fileInput.click();
    });

    fileInput.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    let data = JSON.parse(event.target.result);
                    if (Array.isArray(data) && data.length > 0) {
                        data = data[0].values || data[0];
                    }

                    Object.keys(data).forEach((key) => {
                        const input = container.querySelector(`[data-key="${key}"]`);
                        if (input) {
                            if (input.type === "checkbox") {
                                input.checked = Boolean(data[key]);
                            } else {
                                if (key === "mainNumber" && data[key] === "نسخ احتياطي") {
                                    input.value = "";
                                } else {
                                    input.value = data[key] !== undefined ? data[key] : "";
                                }
                            }
                        }
                    });

                    const manualToggleEvt = new Event('input', { bubbles: true });
                    trigger.dispatchEvent(manualToggleEvt);
                    calculateTotals(container);

                    const copyIdAttr = container.getAttribute("data-copy-id");
                    if (copyIdAttr) {
                        const copyIndex = copies.findIndex(c => c.id == copyIdAttr);
                        if (copyIndex !== -1) {
                            copies[copyIndex].values = serializeForm(container);
                            persistCopies();
                        }
                    } else if (container === mainForm) {
                        persistMainForm();
                    }

                    backupModal.style.display = "none";
                    trigger.value = "";
                } catch (err) {
                    console.error(err);
                }
            };
            reader.readAsText(file);
        }
        fileInput.value = "";
    };

    backupModal.querySelectorAll(".btn-backup-close").forEach(btn => {
        btn.addEventListener("click", () => {
            backupModal.style.display = "none";
            trigger.value = "";
        });
    });

    trigger.addEventListener("input", () => {
        if (trigger.value.trim().includes("نسخ احتياطي")) {
            backupModal.style.display = "flex";
        }
    });
}
//5555555555
// ==========================================
// 10. النسخ الاحتياطي الشامل (عبر حقل mainMonth - لكل الصفحات)
// ==========================================
// ==========================================
// النسخ الاحتياطي الشامل أو المرن (يعمل على أي حاوية: الأساسي أو الكلون)
// ==========================================
function setupMainMonthBackup(container = mainForm) {
    if (!container) return;
    const trigger = container.querySelector('[data-key="mainMonth"]');
    if (!trigger) return;

    // إزالة أي مودال قديم خاص بهذا الحقل لمنع التكرار
    const oldModals = container.querySelectorAll(".month-backup-modal");
    oldModals.forEach(m => m.remove());

    const backupModal = document.createElement("div");
    backupModal.className = "modal-overlay month-backup-modal";
    backupModal.style.cssText = "display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); justify-content: center; align-items: center; z-index: 99999;";
    backupModal.innerHTML = `
        <div class="modal-box" style="background: #fff; padding: 25px; border-radius: 8px; min-width: 320px; text-align: center; position: relative; box-shadow: 0 4px 15px rgba(0,0,0,0.2);">
            <button type="button" class="modal-close-x btn-month-backup-close" title="إلغاء" style="position: absolute; top: 10px; left: 10px; background: none; border: none; font-size: 22px; cursor: pointer; color: #666;">×</button>
            <h3 style="margin-top: 0; color: #333;">نسخ احتياطي (الشامل / هذا الشهر)</h3>
            <p style="color: #666; font-size: 14px;">اختر الإجراء المطلوب:</p>
            <div class="modal-actions" style="display: flex; gap: 10px; margin-top: 20px;">
                <button type="button" class="btn-modal btn-month-export" style="flex:1; padding: 10px; background: #007bff; color: #fff; border: none; border-radius: 4px; cursor: pointer;">تصدير الكل</button>
                <button type="button" class="btn-modal btn-month-import" style="flex:1; padding: 10px; background: #28a745; color: #fff; border: none; border-radius: 4px; cursor: pointer;">استيراد الكل</button>
                <button type="button" class="btn-modal btn-cancel btn-month-backup-close" style="flex:1; padding: 10px; background: #6c757d; color: #fff; border: none; border-radius: 4px; cursor: pointer;">إلغاء</button>
            </div>
        </div>
    `;
    document.body.appendChild(backupModal);

    const closeModal = () => {
        backupModal.style.display = "none";
        trigger.value = "";
    };

    // زر التصدير
    backupModal.querySelector(".btn-month-export").addEventListener("click", async () => {
        const allData = {
            mainForm: serializeForm(mainForm),
            copies: copies
        };
        await saveJsonFile(allData, `all_pages_backup_${Date.now()}.json`);
        closeModal();
    });

    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = ".json";
    fileInput.style.display = "none";
    document.body.appendChild(fileInput);

    backupModal.querySelector(".btn-month-import").addEventListener("click", () => {
        fileInput.click();
    });

    fileInput.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const parsedData = JSON.parse(event.target.result);

                    clearMainForm();
                    if (savedCopiesContainer) {
                        savedCopiesContainer.innerHTML = "";
                    }
                    copies = [];
                    localStorage.removeItem("insurance_form_copies");

                    if (parsedData.mainForm) {
                        deserializeForm(mainForm, parsedData.mainForm);
                        persistMainForm();
                    }

                    if (Array.isArray(parsedData.copies)) {
                        copies = parsedData.copies;
                        persistCopies();
                        copies.forEach((copyData) => renderCopy(copyData));
                        updateSavedHeading();
                    }

                    const manualToggleEvt = new Event('input', { bubbles: true });
                    trigger.dispatchEvent(manualToggleEvt);
                    calculateTotals(container);

                    closeModal();
                } catch (err) {
                    console.error("خطأ في قراءة ملف النسخ الاحتياطي", err);
                    closeModal();
                }
            };
            reader.readAsText(file);
        } else {
            closeModal();
        }
        fileInput.value = "";
    };

    backupModal.querySelectorAll(".btn-month-backup-close").forEach(btn => {
        btn.addEventListener("click", closeModal);
    });

    trigger.addEventListener("input", () => {
        if (trigger.value.trim().includes("نسخ احتياطي")) {
            backupModal.style.display = "flex";
        }
    });
}
// ==========================================
// 11. التشغيل عند تحميل الصفحة
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    loadMainFormBackup();
    loadCopies();
    setupDigitAutoTab(document);
    setupDateInputs(document);
    setupManualTotalsToggle(mainForm);
    setupAutoCalc(mainForm);
    setupMainNumberBackup(mainForm);
    setupMainMonthBackup();
});
