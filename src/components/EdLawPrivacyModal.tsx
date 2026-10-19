import React from 'react';
import { X, ShieldCheck, Printer, Lock, CheckCircle2, FileText, UserCheck, Server, AlertCircle } from 'lucide-react';

interface EdLawPrivacyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const EdLawPrivacyModal: React.FC<EdLawPrivacyModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden text-white print:bg-white print:text-black print:border-none print:shadow-none print:max-h-none print:w-full"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between print:border-b-2 print:border-black print:bg-transparent">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-400 print:hidden">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold leading-tight text-white print:text-black">
                NY State Education Law § 2-d Compliance Statement
              </h2>
              <p className="text-xs text-slate-400 print:text-slate-600">
                Parents&apos; Bill of Rights for Data Privacy &amp; Security • Staff Composer
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 print:hidden">
            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / Save PDF</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs sm:text-sm text-slate-300 leading-relaxed print:text-black print:overflow-visible">
          {/* Executive Summary Badge */}
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 space-y-2 print:border-black print:bg-transparent">
            <div className="flex items-center gap-2 text-emerald-400 print:text-black font-bold text-sm">
              <CheckCircle2 className="w-4 h-4" />
              <span>Executive Summary for School District Administrators &amp; DPOs</span>
            </div>
            <p className="text-xs text-slate-300 print:text-black">
              Mr. Arthur&apos;s Staff Composer is designed specifically for elementary and middle school music education with <strong>strict data minimization</strong>. It collects <strong>zero sensitive PII</strong> (no emails, no home addresses, no birthdates, and no state student IDs). Student data is never sold, shared, monetized, or subjected to behavioral profiling.
            </p>
          </div>

          {/* SECTION 1: PARENTS' BILL OF RIGHTS */}
          <div className="space-y-3">
            <h3 className="text-sm sm:text-base font-bold text-white print:text-black flex items-center gap-2 border-b border-slate-800 pb-1.5 print:border-black">
              <FileText className="w-4 h-4 text-sky-400 print:text-black" />
              <span>1. Parents&apos; Bill of Rights for Data Privacy and Security</span>
            </h3>
            <p className="text-xs text-slate-400 print:text-slate-700">
              Pursuant to New York State Education Law § 2-d and Section 121.3 of the Commissioner&apos;s Regulations, parents, legal guardians, and persons in parental relation to students have the following rights:
            </p>
            <ol className="list-decimal pl-5 space-y-2 text-xs text-slate-300 print:text-black">
              <li>
                <strong>No Commercial Use:</strong> A student&apos;s personally identifiable information (PII) cannot be sold, rented, or released for any commercial, marketing, or advertising purposes.
              </li>
              <li>
                <strong>Right to Inspect Records:</strong> Parents have the right to inspect and review the complete contents of their child&apos;s education record, including any saved music compositions.
              </li>
              <li>
                <strong>State &amp; Federal Security Safeguards:</strong> State and federal laws protect the confidentiality of student PII. Technical and organizational safeguards complying with the NIST Cybersecurity Framework (including transport encryption, isolated storage, and role-based access) are maintained.
              </li>
              <li>
                <strong>State Data Inventory:</strong> A complete list of all student data elements collected by the New York State Education Department is available at <span className="text-sky-300 print:text-black underline">nysed.gov</span> or by writing to the Chief Privacy Officer, New York State Education Department, 89 Washington Avenue, Albany, NY 12234.
              </li>
              <li>
                <strong>Right to File Inquiries &amp; Complaints:</strong> Parents have the right to file complaints about possible breaches of student data. Complaints may be directed to the school district&apos;s Data Protection Officer (DPO) or directly to the NYSED Chief Privacy Officer.
              </li>
            </ol>
          </div>

          {/* SECTION 2: SUPPLEMENTAL INFORMATION */}
          <div className="space-y-3">
            <h3 className="text-sm sm:text-base font-bold text-white print:text-black flex items-center gap-2 border-b border-slate-800 pb-1.5 print:border-black">
              <Lock className="w-4 h-4 text-amber-400 print:text-black" />
              <span>2. Supplemental Information Statement (Part 121.3)</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1 print:border print:border-slate-300 print:bg-transparent">
                <span className="font-bold text-white print:text-black">A. Exclusive Educational Purpose</span>
                <p className="text-slate-400 print:text-slate-700">
                  Data is collected solely to allow students to save and resume their music notation compositions across classroom music sessions.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1 print:border print:border-slate-300 print:bg-transparent">
                <span className="font-bold text-white print:text-black">B. Data Minimization (Fields Collected)</span>
                <p className="text-slate-400 print:text-slate-700">
                  Only <strong>First Name + Last Initial</strong> (e.g., &quot;Alex M.&quot;) and a student-selected 4-digit PIN. No emails, phone numbers, addresses, or student IDs.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1 print:border print:border-slate-300 print:bg-transparent">
                <span className="font-bold text-white print:text-black">C. Subcontractors &amp; Third Parties</span>
                <p className="text-slate-400 print:text-slate-700">
                  <strong>Zero (0)</strong> third-party contractors, analytics companies, or ad networks. No student data is transmitted to external vendors.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1 print:border print:border-slate-300 print:bg-transparent">
                <span className="font-bold text-white print:text-black">D. Data Storage &amp; Sovereignty</span>
                <p className="text-slate-400 print:text-slate-700">
                  Classroom data is stored on the school/district&apos;s authorized web server in a protected directory isolated from direct public web access.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1 print:border print:border-slate-300 print:bg-transparent">
                <span className="font-bold text-white print:text-black">E. Data Retention &amp; Destruction</span>
                <p className="text-slate-400 print:text-slate-700">
                  Teachers maintain full administrative control to purge, export, or permanently delete student accounts and saved projects at any time.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1 print:border print:border-slate-300 print:bg-transparent">
                <span className="font-bold text-white print:text-black">F. Encryption Standards</span>
                <p className="text-slate-400 print:text-slate-700">
                  Encrypted in transit using HTTPS / TLS 1.2+ (aligned with NIST SP 800-52). Database access blocked at the server filesystem level.
                </p>
              </div>
            </div>
          </div>

          {/* SECTION 3: TECHNICAL SAFEGUARDS */}
          <div className="space-y-3">
            <h3 className="text-sm sm:text-base font-bold text-white print:text-black flex items-center gap-2 border-b border-slate-800 pb-1.5 print:border-black">
              <Server className="w-4 h-4 text-purple-400 print:text-black" />
              <span>3. Technical Security Controls (NIST CSF Alignment)</span>
            </h3>
            <ul className="space-y-1.5 text-xs text-slate-300 print:text-black list-disc pl-5">
              <li>
                <strong>Web Root Isolation:</strong> Database storage is located outside the public web root with strict Apache 2.2/2.4 and Nginx execution guards to prevent unauthorized web scraping.
              </li>
              <li>
                <strong>HTTP Security Headers:</strong> Incorporates <code>X-Content-Type-Options: nosniff</code>, <code>X-Frame-Options: SAMEORIGIN</code>, and <code>Referrer-Policy</code>.
              </li>
              <li>
                <strong>Administrative Separation:</strong> Teacher administrative controls (roster editing, PIN overrides, project deletion) are protected by a dedicated Teacher Admin PIN.
              </li>
              <li>
                <strong>Data Portability:</strong> Teachers can download a complete JSON backup of student compositions or migrate data with zero vendor lock-in.
              </li>
            </ul>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between print:hidden">
          <span className="text-[11px] text-slate-400">
            N.Y. Educ. Law § 2-d &amp; 8 N.Y.C.R.R. Part 121
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
