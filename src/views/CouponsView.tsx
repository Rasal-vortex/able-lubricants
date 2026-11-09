import React, { useCallback, useEffect, useState } from "react";
import { useApp } from "../context/AppContext";
import {
  ApiCoupon,
  ApiCouponRedemption,
  CouponFilter,
  createCouponRequest,
  deleteCouponRequest,
  getAllCouponsRequest,
  getCouponRedemptionsRequest,
  updateCouponRequest,
} from "../services/api";
import { formatCurrency } from "../utils/currency";
import {
  CouponFieldErrors,
  getCouponFieldErrors,
  normalizeCouponCode,
} from "../utils/coupons";

interface CouponDraft {
  code: string;
  price: string;
}

const FILTERS: Array<{ value: CouponFilter; label: string }> = [
  { value: "all", label: "All coupons" },
  { value: "sales-based", label: "Sales-based" },
  { value: "non-sale-based", label: "Regular" },
];

const emptyDraft: CouponDraft = { code: "", price: "" };

export const CouponsView: React.FC = () => {
  const { authSession, showToast } = useApp();
  const [filter, setFilter] = useState<CouponFilter>("all");
  const [coupons, setCoupons] = useState<ApiCoupon[]>([]);
  const [redemptions, setRedemptions] = useState<ApiCouponRedemption[]>([]);
  const [couponRecordCodes, setCouponRecordCodes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<ApiCoupon | null>(null);
  const [draft, setDraft] = useState<CouponDraft>(emptyDraft);
  const [fieldErrors, setFieldErrors] = useState<CouponFieldErrors>({});
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ApiCoupon | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState("");

  const loadCoupons = useCallback(async () => {
    if (!authSession) {
      setLoading(false);
      setLoadError("Sign in to view coupons.");
      return;
    }
    setLoading(true);
    setLoadError("");
    try {
      const [result, allCouponRows, redemptionRows] = await Promise.all([
        getAllCouponsRequest(authSession.token, filter),
        getAllCouponsRequest(authSession.token, 'all'),
        getCouponRedemptionsRequest(authSession.token),
      ]);
      setCoupons(result);
      setCouponRecordCodes(allCouponRows.map((coupon) => coupon.code));
      setRedemptions(redemptionRows);
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : "Coupons could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }, [authSession, filter]);

  useEffect(() => {
    void loadCoupons();
  }, [loadCoupons]);

  const openCreateForm = () => {
    setEditingCoupon(null);
    setDraft(emptyDraft);
    setFieldErrors({});
    setFormOpen(true);
  };

  const openEditForm = (coupon: ApiCoupon) => {
    setEditingCoupon(coupon);
    setDraft({
      code: normalizeCouponCode(coupon.code),
      price: String(coupon.price),
    });
    setFieldErrors({});
    setFormOpen(true);
  };

  const closeForm = () => {
    if (saving) return;
    setFormOpen(false);
    setEditingCoupon(null);
    setFieldErrors({});
  };

  const saveCoupon = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!authSession) {
      setFieldErrors({ form: "Sign in to save coupons." });
      return;
    }
    const code = normalizeCouponCode(draft.code);
    const price = Number(draft.price);
    const validation: CouponFieldErrors = {};
    if (!code) validation.code = "Enter a coupon code.";
    if (!Number.isFinite(price) || price <= 0)
      validation.price = "Enter an amount greater than zero.";
    if (code.length > 80)
      validation.code = "Coupon codes can be at most 80 characters.";
    if (Object.keys(validation).length > 0) {
      setFieldErrors(validation);
      return;
    }

    setSaving(true);
    setFieldErrors({});
    try {
      const payload = { code, price };
      if (editingCoupon) {
        await updateCouponRequest(authSession.token, editingCoupon.id, payload);
        showToast(`Coupon ${code} updated.`);
      } else {
        await createCouponRequest(authSession.token, payload);
        showToast(`Regular coupon ${code} created.`);
      }
      setFormOpen(false);
      setEditingCoupon(null);
      await loadCoupons();
    } catch (error) {
      setFieldErrors(getCouponFieldErrors(error));
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!authSession || !deleteTarget) return;
    setDeleting(true);
    setActionError("");
    try {
      await deleteCouponRequest(authSession.token, deleteTarget.id);
      showToast(
        `Coupon ${normalizeCouponCode(deleteTarget.code)} deleted.`,
        "info",
      );
      setDeleteTarget(null);
      await loadCoupons();
    } catch (error) {
      const mapped = getCouponFieldErrors(error);
      setActionError(
        mapped.form || mapped.code || "The coupon could not be deleted.",
      );
    } finally {
      setDeleting(false);
    }
  };

  const legacyCouponUses = filter === 'all'
    ? Object.entries(redemptions.reduce<Record<string, number>>((totals, redemption) => {
        if (!couponRecordCodes.includes(redemption.code)) {
          totals[redemption.code] = (totals[redemption.code] || 0) + Number(redemption.amount);
        }
        return totals;
      }, {}))
    : [];
  const hasVisibleCoupons = coupons.length > 0 || legacyCouponUses.length > 0;

  return (
    <div className="flex flex-col gap-space-md">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-title-lg font-semibold text-on-surface">
            Coupons
          </h1>
          <p className="mt-1 text-sm text-on-surface-variant">
            Manage regular records and review coupons attached to sales.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreateForm}
          className="h-10 rounded-md bg-primary px-4 text-sm font-semibold text-on-primary hover:bg-primary/90"
        >
          Create regular coupon
        </button>
      </header>

      <section className="overflow-hidden rounded-lg border border-outline-variant/20 bg-surface-container-lowest shadow-sm">
        <div className="flex flex-col gap-3 border-b border-outline-variant/20 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold text-on-surface">Coupon records</h2>
            <p className="text-xs text-on-surface-variant">
              Sale-based coupons are read-only.
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm text-on-surface-variant">
            <span>Show</span>
            <select
              aria-label="Filter coupons"
              value={filter}
              onChange={(event) =>
                setFilter(event.target.value as CouponFilter)
              }
              className="h-9 rounded border border-outline-variant/30 bg-white px-2 text-on-surface"
            >
              {FILTERS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {loadError && (
          <div
            role="alert"
            className="m-4 flex flex-wrap items-center justify-between gap-3 rounded-md bg-error-container/40 px-4 py-3 text-sm text-error"
          >
            <span>{loadError}</span>
            <button
              type="button"
              onClick={() => void loadCoupons()}
              className="font-semibold underline"
            >
              Try again
            </button>
          </div>
        )}

        {loading ? (
          <div
            role="status"
            className="px-4 py-12 text-center text-sm text-on-surface-variant"
          >
            Loading coupons…
          </div>
        ) : loadError ? null : !hasVisibleCoupons ? (
          <div className="px-4 py-12 text-center">
            <p className="font-medium text-on-surface">No coupons found</p>
            <p className="mt-1 text-sm text-on-surface-variant">
              Try another filter or create a regular coupon.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-surface-container-low text-xs uppercase tracking-wide text-on-surface-variant">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Code
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-right font-semibold"
                  >
                    Amount
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">Redeemed</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">Remaining</th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Type
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-right font-semibold"
                  >
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/20">
                {coupons.map((coupon) => (
                  <tr
                    key={coupon.id}
                    className="hover:bg-surface-container-low/50"
                  >
                    <td className="px-4 py-3 font-mono font-semibold text-on-surface">
                      {normalizeCouponCode(coupon.code)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-on-surface">
                      {formatCurrency(Number(coupon.price))}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-on-surface-variant">
                      {coupon.isSaleBased ? '—' : formatCurrency(Number(coupon.redeemedAmount || 0))}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-on-surface">
                      {coupon.isSaleBased ? '—' : formatCurrency(Number(coupon.remainingAmount ?? coupon.price))}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${coupon.isSaleBased ? "bg-surface-variant text-on-surface-variant" : "bg-primary-container/20 text-primary"}`}
                      >
                        {coupon.isSaleBased ? "Sale-based" : "Regular"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {!coupon.isSaleBased ? (
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => openEditForm(coupon)}
                            className="rounded px-2 py-1 font-medium text-primary hover:bg-primary-container/20"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setDeleteTarget(coupon);
                              setActionError("");
                            }}
                            className="rounded px-2 py-1 font-medium text-error hover:bg-error-container/40"
                          >
                            Delete
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-on-surface-variant">
                          Read-only
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
                {legacyCouponUses.map(([code, amount]) => (
                  <tr key={`past-use-${code}`} className="bg-surface-container-low/40">
                    <td className="px-4 py-3 font-mono font-semibold text-on-surface">{code}</td>
                    <td className="px-4 py-3 text-right font-mono text-on-surface">{formatCurrency(amount)}</td>
                    <td className="px-4 py-3 text-right font-mono text-on-surface-variant">{formatCurrency(amount)}</td>
                    <td className="px-4 py-3 text-right font-mono text-on-surface-variant">—</td>
                    <td className="px-4 py-3"><span className="inline-flex rounded-full bg-primary-container/20 px-2.5 py-1 text-xs font-medium text-primary">Regular</span></td>
                    <td className="px-4 py-3 text-right text-xs text-on-surface-variant">Used in bill</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {formOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeForm();
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="coupon-form-title"
            className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2
                  id="coupon-form-title"
                  className="text-lg font-semibold text-on-surface"
                >
                  {editingCoupon
                    ? "Edit regular coupon"
                    : "Create regular coupon"}
                </h2>
                <p className="mt-1 text-sm text-on-surface-variant">
                  Enter a code and fixed discount amount.
                </p>
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={closeForm}
                className="rounded p-1 text-on-surface-variant hover:bg-surface-container-low"
                disabled={saving}
              >
                ✕
              </button>
            </div>
            <form
              onSubmit={saveCoupon}
              className="flex flex-col gap-4"
              noValidate
            >
              <label
                className="flex flex-col gap-1.5 text-sm font-medium text-on-surface"
                htmlFor="coupon-code"
              >
                Code
                <input
                  id="coupon-code"
                  value={draft.code}
                  onChange={(event) => {
                    setDraft((current) => ({
                      ...current,
                      code: normalizeCouponCode(event.target.value),
                    }));
                    setFieldErrors((current) => ({
                      ...current,
                      code: undefined,
                      form: undefined,
                    }));
                  }}
                  maxLength={80}
                  autoFocus
                  className="h-10 rounded-md border border-outline-variant/40 px-3 font-mono uppercase outline-none focus:border-primary"
                  placeholder="SAVE100"
                  aria-invalid={Boolean(fieldErrors.code)}
                  aria-describedby={
                    fieldErrors.code ? "coupon-code-error" : undefined
                  }
                />
                {fieldErrors.code && (
                  <span
                    id="coupon-code-error"
                    role="alert"
                    className="text-xs font-normal text-error"
                  >
                    {fieldErrors.code}
                  </span>
                )}
              </label>
              <label
                className="flex flex-col gap-1.5 text-sm font-medium text-on-surface"
                htmlFor="coupon-price"
              >
                Fixed amount (₹)
                <input
                  id="coupon-price"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={draft.price}
                  onChange={(event) => {
                    setDraft((current) => ({
                      ...current,
                      price: event.target.value,
                    }));
                    setFieldErrors((current) => ({
                      ...current,
                      price: undefined,
                      form: undefined,
                    }));
                  }}
                  className="h-10 rounded-md border border-outline-variant/40 px-3 outline-none focus:border-primary"
                  placeholder="100.00"
                  aria-invalid={Boolean(fieldErrors.price)}
                  aria-describedby={
                    fieldErrors.price ? "coupon-price-error" : undefined
                  }
                />
                {fieldErrors.price && (
                  <span
                    id="coupon-price-error"
                    role="alert"
                    className="text-xs font-normal text-error"
                  >
                    {fieldErrors.price}
                  </span>
                )}
              </label>
              {fieldErrors.form && (
                <p
                  role="alert"
                  className="rounded-md bg-error-container/40 px-3 py-2 text-sm text-error"
                >
                  {fieldErrors.form}
                </p>
              )}
              <div className="mt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeForm}
                  disabled={saving}
                  className="h-9 rounded-md border border-outline-variant/40 px-4 text-sm font-medium text-on-surface"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="h-9 rounded-md bg-primary px-4 text-sm font-semibold text-on-primary disabled:opacity-60"
                >
                  {saving
                    ? "Saving…"
                    : editingCoupon
                      ? "Save changes"
                      : "Create coupon"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
          <section
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-coupon-title"
            className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl"
          >
            <h2
              id="delete-coupon-title"
              className="text-lg font-semibold text-on-surface"
            >
              Delete coupon?
            </h2>
            <p className="mt-2 text-sm text-on-surface-variant">
              This will delete regular coupon{" "}
              <strong className="font-mono text-on-surface">
                {normalizeCouponCode(deleteTarget.code)}
              </strong>
              .
            </p>
            {actionError && (
              <p
                role="alert"
                className="mt-3 rounded-md bg-error-container/40 px-3 py-2 text-sm text-error"
              >
                {actionError}
              </p>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="h-9 rounded-md border border-outline-variant/40 px-4 text-sm font-medium text-on-surface"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void confirmDelete()}
                disabled={deleting}
                className="h-9 rounded-md bg-error px-4 text-sm font-semibold text-white disabled:opacity-60"
              >
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
};
