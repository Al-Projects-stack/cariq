import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  adminCreateModel, adminGetJob, adminGetModel, adminModelDiff,
  adminPublishModel, adminReplaceChecklist, adminReplaceFaults,
  adminReplacePrices, adminUpdateProfile,
} from "../../api";
import type { AdminModelDetail, AdminModelCreate, AdminFault, AdminPriceRange, DiffChange } from "../../types";
import { useAdmin } from "../../contexts/AdminContext";
import { Card, Loading, ErrorBox, Toasts, useToasts, DiffView, inputCls, btnPrimary, btnGhost } from "../../components/admin/ui";

type Tab = "profile" | "faults" | "prices" | "checklist";

const EMPTY_CREATE: AdminModelCreate = {
  make: "", model: "", variants: [], years_covered: "", sa_market_summary: "",
  reliability_score: 7, segment: "", fuel_type: "", fuel_consumption_l_per_100km: null,
  annual_maintenance_zar: null, annual_insurance_zar: null, owner_sentiment: "",
  sources: [], faults: [], price_ranges: [], checklist: [],
};

const EMPTY_FAULT: AdminFault = {
  title: "", description: "", severity: "MEDIUM", mileage_range: "",
  what_to_inspect: "", repair_min_zar: null, repair_max_zar: null,
  affects_variants: [], affected_years: null, source: "",
};

function Field({ label, children, error }: { label: string; children: React.ReactNode; error?: string }) {
  return (
    <label className="block text-xs font-semibold uppercase tracking-widest text-gray-500">
      {label}
      <div className="mt-1 normal-case tracking-normal">{children}</div>
      {error && <p className="mt-1 text-xs normal-case tracking-normal text-red-400">{error}</p>}
    </label>
  );
}

export function validateFault(f: AdminFault): string | null {
  if (f.title.trim().length < 3) return "Title needs at least 3 characters";
  if (f.repair_min_zar !== null && f.repair_max_zar !== null && f.repair_min_zar > f.repair_max_zar)
    return "Repair min must be ≤ max";
  return null;
}

export function validatePrice(p: AdminPriceRange): string | null {
  if (!(p.low_zar > 0 && p.mid_zar > 0 && p.high_zar > 0)) return "Prices must be positive";
  if (!(p.low_zar <= p.mid_zar && p.mid_zar <= p.high_zar)) return "Need low ≤ mid ≤ high";
  if (p.year_to < p.year_from) return "year_to must be ≥ year_from";
  return null;
}

export function AdminModelEditor() {
  const { slug } = useParams();
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const { admin } = useAdmin();
  const { toasts, notify } = useToasts();
  const isNew = !slug;
  const isAdmin = admin?.role === "admin";

  const [tab, setTab] = useState<Tab>("profile");
  const [detail, setDetail] = useState<AdminModelDetail | null>(null);
  const [form, setForm] = useState<AdminModelCreate>(() => {
    try {
      const raw = sessionStorage.getItem("cariq_prefill");
      if (isNew && search.get("prefill") && raw) {
        sessionStorage.removeItem("cariq_prefill");
        return { ...EMPTY_CREATE, ...(JSON.parse(raw) as Partial<AdminModelCreate>) };
      }
    } catch {
      // ignore bad prefill
    }
    return EMPTY_CREATE;
  });
  const [loading, setLoading] = useState(!isNew);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [diff, setDiff] = useState<DiffChange[] | null>(null);
  const [showPublish, setShowPublish] = useState(false);
  const [jobStatus, setJobStatus] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (isNew) return;
    setLoading(true);
    setError(null);
    try {
      const d = await adminGetModel(slug as string);
      setDetail(d);
      setForm({
        make: d.make, model: d.model, variants: d.variants, years_covered: d.years_covered,
        sa_market_summary: d.sa_market_summary, reliability_score: d.reliability_score,
        segment: d.segment, fuel_type: d.fuel_type,
        fuel_consumption_l_per_100km: d.fuel_consumption_l_per_100km,
        annual_maintenance_zar: d.annual_maintenance_zar,
        annual_insurance_zar: d.annual_insurance_zar,
        owner_sentiment: d.owner_sentiment, sources: d.sources,
        faults: d.faults, price_ranges: d.price_ranges, checklist: d.checklist,
      });
      setDirty(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [slug, isNew]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    function onUnload(e: BeforeUnloadEvent) {
      if (dirty) e.preventDefault();
    }
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, [dirty]);

  function set<K extends keyof AdminModelCreate>(key: K, value: AdminModelCreate[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setDirty(true);
  }

  async function saveSection() {
    if (!detail && !isNew) return;
    setSaving(true);
    try {
      if (isNew) {
        if (!form.make.trim() || !form.model.trim()) {
          notify("err", "Make and model are required");
          return;
        }
        const created = await adminCreateModel(form);
        notify("ok", "Model created as draft");
        navigate(`/admin/models/${encodeURIComponent(created.slug)}`, { replace: true });
        return;
      }
      const s = (detail as AdminModelDetail).slug;
      if (tab === "profile") {
        await adminUpdateProfile(s, {
          make: form.make, model: form.model, variants: form.variants,
          years_covered: form.years_covered, sa_market_summary: form.sa_market_summary,
          reliability_score: form.reliability_score, segment: form.segment,
          fuel_type: form.fuel_type, fuel_consumption_l_per_100km: form.fuel_consumption_l_per_100km,
          annual_maintenance_zar: form.annual_maintenance_zar,
          annual_insurance_zar: form.annual_insurance_zar,
          owner_sentiment: form.owner_sentiment, sources: form.sources,
        });
      } else if (tab === "faults") {
        for (const f of form.faults) {
          const err = validateFault(f);
          if (err) {
            notify("err", `Fault "${f.title || "?"}": ${err}`);
            return;
          }
        }
        await adminReplaceFaults(s, form.faults);
      } else if (tab === "prices") {
        for (const p of form.price_ranges) {
          const err = validatePrice(p);
          if (err) {
            notify("err", `Price ${p.year_from}-${p.year_to}: ${err}`);
            return;
          }
        }
        await adminReplacePrices(s, form.price_ranges);
      } else {
        await adminReplaceChecklist(s, form.checklist);
      }
      notify("ok", "Draft saved");
      setDirty(false);
      load();
    } catch (e) {
      notify("err", e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function previewDiff() {
    if (!detail) return;
    try {
      const d = await adminModelDiff(detail.slug);
      setDiff(d.changes);
    } catch (e) {
      notify("err", e instanceof Error ? e.message : "Diff failed");
    }
  }

  async function publish() {
    if (!detail) return;
    try {
      const { job_id } = await adminPublishModel(detail.slug);
      setShowPublish(false);
      setJobStatus("queued");
      notify("ok", `Publish queued (job ${job_id})`);
      const poll = async () => {
        try {
          const job = await adminGetJob(job_id);
          setJobStatus(job.status);
          if (job.status === "done") {
            notify("ok", "Published to Pinecone");
            setDirty(false);
            load();
          } else if (job.status === "failed") {
            notify("err", `Publish failed: ${job.error || "unknown error"}`);
          } else {
            setTimeout(poll, 2500);
          }
        } catch (e) {
          notify("err", e instanceof Error ? e.message : "Job poll failed");
        }
      };
      setTimeout(poll, 2000);
    } catch (e) {
      notify("err", e instanceof Error ? e.message : "Publish failed");
    }
  }

  if (loading) return <Loading />;
  if (error) return <ErrorBox text={error} onRetry={load} />;

  return (
    <div className="space-y-4">
      <Toasts toasts={toasts} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <Link to="/admin/models" className="text-sm text-gray-500 hover:text-orange-400">← Models</Link>
          <h1 className="text-xl font-bold text-gray-100">
            {isNew ? "New model" : `${detail?.make} ${detail?.model}`}
          </h1>
          {dirty && <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs text-amber-300">unsaved changes</span>}
          {jobStatus && !["done", "failed"].includes(jobStatus) && (
            <span className="rounded-full bg-blue-500/15 px-2 py-0.5 text-xs text-blue-300">publish: {jobStatus}...</span>
          )}
        </div>
        <div className="flex gap-2">
          {!isNew && <Link to={`/admin/models/${encodeURIComponent((detail as AdminModelDetail).slug)}/versions`} className={btnGhost()}>Versions</Link>}
          {!isNew && <button onClick={previewDiff} className={btnGhost()}>Preview diff</button>}
          {!isNew && isAdmin && <button onClick={() => setShowPublish(true)} className={btnPrimary()}>Publish</button>}
          <button onClick={saveSection} disabled={saving} className={btnPrimary(saving)}>
            {saving ? "Saving..." : isNew ? "Create draft" : "Save draft"}
          </button>
        </div>
      </div>

      {diff && (
        <Card>
          <h2 className="mb-2 text-sm font-semibold text-gray-200">Unpublished changes ({diff.length})</h2>
          <DiffView changes={diff} />
        </Card>
      )}

      <div className="flex gap-1 border-b border-gray-800" role="tablist">
        {(["profile", "faults", "prices", "checklist"] as Tab[]).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize ${tab === t ? "border-b-2 border-orange-500 text-orange-300" : "text-gray-500 hover:text-gray-200"}`}
          >
            {t}{t === "faults" ? ` (${form.faults.length})` : t === "prices" ? ` (${form.price_ranges.length})` : ""}
          </button>
        ))}
      </div>

      {tab === "profile" && <ProfileTab form={form} set={set} />}
      {tab === "faults" && <FaultsTab faults={form.faults} setFaults={(v) => set("faults", v)} />}
      {tab === "prices" && <PricesTab prices={form.price_ranges} setPrices={(v) => set("price_ranges", v)} />}
      {tab === "checklist" && <ChecklistTab items={form.checklist} setItems={(v) => set("checklist", v)} />}

      {showPublish && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4" role="dialog" aria-modal="true" aria-label="Confirm publish">
          <div className="w-full max-w-lg rounded-2xl border border-gray-700 bg-gray-900 p-6">
            <h2 className="text-lg font-bold text-gray-100">Publish to Pinecone?</h2>
            <p className="mt-1 text-sm text-gray-400">This overwrites the live vectors for this model. The previous published version stays marked live if the sync fails.</p>
            <div className="mt-3 max-h-64 overflow-y-auto">
              <DiffView changes={diff || []} />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setShowPublish(false)} className={btnGhost()}>Cancel</button>
              <button onClick={publish} className={btnPrimary()}>Publish now</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ProfileTab({ form, set }: { form: AdminModelCreate; set: <K extends keyof AdminModelCreate>(k: K, v: AdminModelCreate[K]) => void }) {
  const num = (v: string) => (v === "" ? null : Number(v));
  return (
    <Card>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Make"><input value={form.make} onChange={(e) => set("make", e.target.value)} className={inputCls()} /></Field>
        <Field label="Model"><input value={form.model} onChange={(e) => set("model", e.target.value)} className={inputCls()} /></Field>
        <Field label="Variants (comma separated)">
          <input value={form.variants.join(", ")} onChange={(e) => set("variants", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))} className={inputCls()} />
        </Field>
        <Field label="Years covered"><input value={form.years_covered} onChange={(e) => set("years_covered", e.target.value)} className={inputCls()} placeholder="2012-2022" /></Field>
        <Field label="Reliability score (0-10)">
          <input type="number" min={0} max={10} step={0.1} value={form.reliability_score} onChange={(e) => set("reliability_score", Number(e.target.value))} className={inputCls()} />
        </Field>
        <Field label="Segment"><input value={form.segment} onChange={(e) => set("segment", e.target.value)} className={inputCls()} /></Field>
        <Field label="Fuel type"><input value={form.fuel_type} onChange={(e) => set("fuel_type", e.target.value)} className={inputCls()} /></Field>
        <Field label="Fuel consumption (L/100km)">
          <input type="number" step={0.1} value={form.fuel_consumption_l_per_100km ?? ""} onChange={(e) => set("fuel_consumption_l_per_100km", num(e.target.value))} className={inputCls()} />
        </Field>
        <Field label="Annual maintenance (ZAR)">
          <input type="number" value={form.annual_maintenance_zar ?? ""} onChange={(e) => set("annual_maintenance_zar", num(e.target.value))} className={inputCls()} />
        </Field>
        <Field label="Annual insurance (ZAR)">
          <input type="number" value={form.annual_insurance_zar ?? ""} onChange={(e) => set("annual_insurance_zar", num(e.target.value))} className={inputCls()} />
        </Field>
        <Field label="Sources (comma separated)">
          <input value={form.sources.join(", ")} onChange={(e) => set("sources", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))} className={inputCls()} />
        </Field>
      </div>
      <div className="mt-4 grid gap-4">
        <Field label="SA market summary">
          <textarea value={form.sa_market_summary} onChange={(e) => set("sa_market_summary", e.target.value)} rows={4} className={inputCls()} />
        </Field>
        <Field label="Owner sentiment">
          <textarea value={form.owner_sentiment} onChange={(e) => set("owner_sentiment", e.target.value)} rows={3} className={inputCls()} />
        </Field>
      </div>
    </Card>
  );
}

function FaultsTab({ faults, setFaults }: { faults: AdminFault[]; setFaults: (v: AdminFault[]) => void }) {
  function update(i: number, patch: Partial<AdminFault>) {
    setFaults(faults.map((f, j) => (j === i ? { ...f, ...patch } : f)));
  }
  function remove(i: number) {
    if (window.confirm("Delete this fault from the draft?")) setFaults(faults.filter((_, j) => j !== i));
  }
  return (
    <div className="space-y-3">
      {faults.map((f, i) => {
        const err = validateFault(f);
        return (
          <Card key={i}>
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-200">{f.title || `Fault ${i + 1}`}</p>
              <button onClick={() => remove(i)} className="text-xs text-red-400 hover:underline">Delete</button>
            </div>
            {err && <p className="mt-1 text-xs text-red-400">{err}</p>}
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Field label="Title"><input value={f.title} onChange={(e) => update(i, { title: e.target.value })} className={inputCls()} /></Field>
              <Field label="Severity">
                <select value={f.severity} onChange={(e) => update(i, { severity: e.target.value as AdminFault["severity"] })} className={inputCls()}>
                  {(["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const).map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
              <div className="sm:col-span-2"><Field label="Description"><textarea value={f.description} onChange={(e) => update(i, { description: e.target.value })} rows={2} className={inputCls()} /></Field></div>
              <Field label="Mileage range"><input value={f.mileage_range} onChange={(e) => update(i, { mileage_range: e.target.value })} className={inputCls()} placeholder="80,000km - 120,000km" /></Field>
              <Field label="Source"><input value={f.source} onChange={(e) => update(i, { source: e.target.value })} className={inputCls()} /></Field>
              <Field label="Repair min (ZAR)">
                <input type="number" value={f.repair_min_zar ?? ""} onChange={(e) => update(i, { repair_min_zar: e.target.value === "" ? null : Number(e.target.value) })} className={inputCls()} />
              </Field>
              <Field label="Repair max (ZAR)">
                <input type="number" value={f.repair_max_zar ?? ""} onChange={(e) => update(i, { repair_max_zar: e.target.value === "" ? null : Number(e.target.value) })} className={inputCls()} />
              </Field>
              <div className="sm:col-span-2"><Field label="What to inspect"><textarea value={f.what_to_inspect} onChange={(e) => update(i, { what_to_inspect: e.target.value })} rows={2} className={inputCls()} /></Field></div>
              <Field label="Affected variants (comma separated)">
                <input value={f.affects_variants.join(", ")} onChange={(e) => update(i, { affects_variants: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} className={inputCls()} />
              </Field>
              <Field label="Affected years (comma separated)">
                <input
                  value={(f.affected_years || []).join(", ")}
                  onChange={(e) => update(i, {
                    affected_years: e.target.value.trim()
                      ? e.target.value.split(",").map((s) => Number(s.trim())).filter((n) => Number.isFinite(n))
                      : null,
                  })}
                  className={inputCls()}
                  placeholder="2015, 2016"
                />
              </Field>
            </div>
          </Card>
        );
      })}
      <button onClick={() => setFaults([...faults, { ...EMPTY_FAULT }])} className={btnGhost()}>+ Add fault</button>
    </div>
  );
}

function PricesTab({ prices, setPrices }: { prices: AdminPriceRange[]; setPrices: (v: AdminPriceRange[]) => void }) {
  function update(i: number, patch: Partial<AdminPriceRange>) {
    setPrices(prices.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  }
  function remove(i: number) {
    if (window.confirm("Delete this price band from the draft?")) setPrices(prices.filter((_, j) => j !== i));
  }
  const num = (v: string) => Number(v);
  return (
    <div className="space-y-3">
      {prices.map((p, i) => {
        const err = validatePrice(p);
        return (
          <Card key={i}>
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-200">{p.year_from}-{p.year_to}</p>
              <button onClick={() => remove(i)} className="text-xs text-red-400 hover:underline">Delete</button>
            </div>
            {err && <p className="mt-1 text-xs text-red-400">{err}</p>}
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
              <Field label="From"><input type="number" value={p.year_from} onChange={(e) => update(i, { year_from: num(e.target.value) })} className={inputCls()} /></Field>
              <Field label="To"><input type="number" value={p.year_to} onChange={(e) => update(i, { year_to: num(e.target.value) })} className={inputCls()} /></Field>
              <Field label="Low (R)"><input type="number" value={p.low_zar} onChange={(e) => update(i, { low_zar: num(e.target.value) })} className={inputCls()} /></Field>
              <Field label="Mid (R)"><input type="number" value={p.mid_zar} onChange={(e) => update(i, { mid_zar: num(e.target.value) })} className={inputCls()} /></Field>
              <Field label="High (R)"><input type="number" value={p.high_zar} onChange={(e) => update(i, { high_zar: num(e.target.value) })} className={inputCls()} /></Field>
            </div>
          </Card>
        );
      })}
      <button onClick={() => setPrices([...prices, { year_from: 2020, year_to: 2022, low_zar: 100000, mid_zar: 130000, high_zar: 160000 }])} className={btnGhost()}>+ Add price band</button>
    </div>
  );
}

function ChecklistTab({ items, setItems }: { items: { text: string }[]; setItems: (v: { text: string }[]) => void }) {
  return (
    <Card>
      <div className="space-y-2">
        {items.map((it, i) => (
          <div key={i} className="flex gap-2">
            <input
              value={it.text}
              onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))}
              className={inputCls()}
              placeholder={`Check ${i + 1}`}
            />
            <button
              onClick={() => setItems(items.filter((_, j) => j !== i))}
              className="shrink-0 rounded-lg border border-gray-700 px-3 text-sm text-red-400 hover:border-red-500"
              aria-label={`Delete check ${i + 1}`}
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <button onClick={() => setItems([...items, { text: "" }])} className={`${btnGhost()} mt-3`}>+ Add check</button>
    </Card>
  );
}
