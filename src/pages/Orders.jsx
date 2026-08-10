import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import api from "../api";
import {
  Package, Calendar, Check, X, Loader, CheckCircle, XCircle,
  ChevronDown, ChevronUp, Clock, ShoppingBag,
} from "lucide-react";
import toast from "react-hot-toast";
import { format } from "date-fns";

// Firestore "in" queries support at most 30 values per query
const CHUNK_SIZE = 30;
function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

export default function Orders() {
  const { user } = useAuth();
  const [bookingIds, setBookingIds]   = useState([]);
  const [bookingsLoaded, setBookingsLoaded] = useState(false);
  const [orders, setOrders]           = useState([]);
  const [loading, setLoading]         = useState(true);
  const [expandedId, setExpandedId]   = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [approvingId, setApprovingId] = useState(null);
  const [rejectingId, setRejectingId] = useState(null);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/orders/my-orders');
      setOrders(data);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load orders");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchOrders();
    }
  }, [user]);

  const approveOrder = async (orderId) => {
    setApprovingId(orderId);
    try {
      await api.post(`/orders/${orderId}/approve`);
      toast.success("Order approved!");
      fetchOrders();
    } catch (err) {
      console.error(err);
      toast.error("Failed to approve order");
    } finally {
      setApprovingId(null);
    }
  };

  const rejectOrder = async (orderId) => {
    if (!window.confirm("Reject this order?")) return;
    setRejectingId(orderId);
    try {
      await api.post(`/orders/${orderId}/reject`);
      toast.success("Order rejected");
      fetchOrders();
    } catch (err) {
      console.error(err);
      toast.error("Failed to reject order");
    } finally {
      setRejectingId(null);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case "pending_approval":
        return (
          <span className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
            <Clock size={11} /> Pending Approval
          </span>
        );
      case "approved":
        return (
          <span className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20">
            <CheckCircle size={11} /> Approved
          </span>
        );
      case "rejected":
        return (
          <span className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">
            <XCircle size={11} /> Rejected
          </span>
        );
      default:
        return (
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-700 text-slate-400">
            {status}
          </span>
        );
    }
  };

  const getItemsFromOrder = (order) => {
    if (!order.cartGroups) return [];
    const items = [];
    Object.entries(order.cartGroups).forEach(([storeId, storeData]) => {
      (storeData.items || []).forEach((item) => {
        items.push({ ...item, storeId, storeName: storeData.storeName || item.storeName });
      });
    });
    return items;
  };

  const itemsPerPage = 10;
  const totalPages   = Math.ceil(orders.length / itemsPerPage);
  const currentOrders = orders.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const pendingCount = orders.filter((o) => o.status === "pending_approval").length;

  return (
    <div className="min-h-screen court-pattern pt-20 pb-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="pt-6 mb-8">
          <div className="flex items-center gap-3">
            <h1 className="font-display text-4xl tracking-wider text-white">
              MY <span className="gradient-text">ORDERS</span>
            </h1>
            {pendingCount > 0 && (
              <span className="bg-yellow-500 text-slate-900 text-xs font-bold px-2 py-0.5 rounded-full">
                {pendingCount} pending
              </span>
            )}
          </div>
          <p className="text-slate-500 mt-1">Approve or reject food & beverage orders from your court</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader size={32} className="text-green-500 animate-spin" />
          </div>
        ) : orders.length === 0 ? (
          <div className="card p-12 text-center flex flex-col items-center">
            <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mb-4">
              <Package size={32} className="text-slate-500" />
            </div>
            <h3 className="text-xl font-medium text-white mb-2">No orders yet</h3>
            <p className="text-slate-400 max-w-md">
              Orders placed by your group at the court will appear here for your approval.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {currentOrders.map((order) => {
              const dateStr = order.createdAt?.toDate
                ? format(order.createdAt.toDate(), "MMM d, yyyy h:mm a")
                : "Unknown date";
              const isExpanded = expandedId === order.id;
              const items      = getItemsFromOrder(order);
              const isPending  = order.status === "pending_approval";

              return (
                <div
                  key={order.id}
                  className={`card p-3 sm:p-4 transition-all rounded-xl ${isPending ? "border-yellow-500/30 shadow-yellow-500/5 shadow-lg" : "hover:border-green-500/20"}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="text-white font-semibold text-sm truncate">
                          {order.courtName || "Unknown Court"}
                        </h3>
                        {getStatusBadge(order.status)}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-400 flex-wrap">
                        <div className="flex items-center gap-1.5">
                          <Calendar size={12} className="text-green-500/80" />
                          <span>{dateStr}</span>
                        </div>
                        <span className="text-slate-600 hidden sm:inline">•</span>
                        <span className="truncate">
                          Guest: <span className="text-slate-300">{order.guestName || "Unknown"}</span>
                        </span>
                        <span className="text-slate-600 hidden sm:inline">•</span>
                        <span className="truncate">
                          Booker: <span className="text-slate-300">{order.bookerName || "—"}</span>
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col items-end shrink-0 gap-1">
                      <div className="text-lg font-bold text-white leading-none">
                        ₱{order.grandTotal ?? order.totalAmount ?? 0}
                      </div>
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : order.id)}
                        className="text-xs text-slate-400 hover:text-white flex items-center gap-1 bg-slate-800/50 hover:bg-slate-800 px-2 py-1 rounded transition-colors"
                      >
                        <ShoppingBag size={12} /> {items.length} items
                        {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-slate-800/80">
                      {order.cartGroups && Object.entries(order.cartGroups).map(([storeId, storeData]) => (
                        <div key={storeId} className="bg-slate-800/40 rounded-lg p-3 mb-3">
                          <h4 className="text-xs font-semibold text-green-400 mb-2 uppercase tracking-wider">
                            {storeData.storeName || storeData.items?.[0]?.storeName || "Store"}
                          </h4>
                          <ul className="space-y-1.5">
                            {(storeData.items || []).map((item, idx) => (
                              <li key={idx} className="flex justify-between items-center text-xs">
                                <div className="flex items-center gap-2">
                                  <span className="text-white font-medium bg-slate-800 px-1.5 py-0.5 rounded">
                                    {item.quantity}x
                                  </span>
                                  <span className="text-slate-300">{item.name}</span>
                                  {item.notes && (
                                    <span className="text-slate-500 italic">({item.notes})</span>
                                  )}
                                </div>
                                <span className="text-slate-300 font-medium">₱{item.lineTotal}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}

                      <div className="flex justify-between items-center text-sm font-semibold text-white px-1 mb-4">
                        <span>Grand Total</span>
                        <span className="text-green-400">₱{order.grandTotal ?? order.totalAmount ?? 0}</span>
                      </div>

                      {isPending && (
                        <div className="flex gap-2 justify-end">
                          <button
                            onClick={() => rejectOrder(order.id)}
                            disabled={!!rejectingId}
                            className="btn-secondary px-4 py-2 text-xs flex items-center gap-1.5 text-red-400 hover:text-red-300 hover:border-red-500/30 disabled:opacity-50"
                          >
                            {rejectingId === order.id
                              ? <Loader size={13} className="animate-spin" />
                              : <X size={13} />}
                            Reject
                          </button>
                          <button
                            onClick={() => approveOrder(order.id)}
                            disabled={!!approvingId}
                            className="btn-primary px-4 py-2 text-xs flex items-center gap-1.5 disabled:opacity-50"
                          >
                            {approvingId === order.id
                              ? <Loader size={13} className="animate-spin" />
                              : <Check size={13} />}
                            Approve
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {totalPages > 1 && (
              <div className="flex items-center justify-between bg-slate-800/30 p-3 rounded-xl border border-slate-700/50 mt-4">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-slate-700 text-white transition-colors"
                >
                  Previous
                </button>
                <span className="text-sm text-slate-400">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-slate-700 text-white transition-colors"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}