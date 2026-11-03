import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { storage } from '../../services/storage';
import { SeatingChart, SeatStudent } from '../../types';
import {
  Grid,
  Plus,
  Printer,
  Copy,
  Trash2,
  Users,
  Music,
  Sparkles,
  MapPin,
  Move,
  Tag,
  Save,
  CheckCircle2
} from 'lucide-react';

export const SeatingChartView: React.FC = () => {
  const { showToast } = useApp();

  const [charts, setCharts] = useState<SeatingChart[]>([]);
  const [selectedChartId, setSelectedChartId] = useState<string | null>(null);
  const [selectedSeat, setSelectedSeat] = useState<{ row: number; col: number } | null>(null);
  const [editingStudent, setEditingStudent] = useState<Partial<SeatStudent>>({});

  const reloadData = () => {
    const allCharts = storage.getSeatingCharts();
    setCharts(allCharts);
    if (!selectedChartId && allCharts.length > 0) {
      setSelectedChartId(allCharts[0].id);
    }
  };

  useEffect(() => {
    reloadData();
    const unsub = storage.subscribe(reloadData);
    return unsub;
  }, []);

  const currentChart = charts.find((c) => c.id === selectedChartId) || charts[0];

  const handleSeatClick = (row: number, col: number) => {
    const existing = currentChart?.students.find((s) => s.row === row && s.col === col);
    setSelectedSeat({ row, col });
    if (existing) {
      setEditingStudent({ ...existing.student });
    } else {
      setEditingStudent({
        name: `Seat ${row + 1}-${col + 1}`,
        seatNumber: row * (currentChart?.seatsPerRow || 8) + col + 1,
        tags: []
      });
    }
  };

  const handleSaveStudent = () => {
    if (!selectedSeat || !currentChart) return;
    const { row, col } = selectedSeat;

    const studentObj: SeatStudent = {
      id: editingStudent.id || 'st-' + Date.now().toString(36),
      name: editingStudent.name?.trim() || 'Student',
      seatNumber: editingStudent.seatNumber || 1,
      voicePart: editingStudent.voicePart,
      notes: editingStudent.notes,
      tags: editingStudent.tags || []
    };

    // Remove old seat at row/col if exists
    const updatedStudents = currentChart.students.filter((s) => !(s.row === row && s.col === col));
    updatedStudents.push({ row, col, student: studentObj });

    storage.updateSeatingChart(currentChart.id, { students: updatedStudents });
    setSelectedSeat(null);
    showToast('Seat updated', 'success');
  };

  const handleClearSeat = () => {
    if (!selectedSeat || !currentChart) return;
    const { row, col } = selectedSeat;
    const updatedStudents = currentChart.students.filter((s) => !(s.row === row && s.col === col));
    storage.updateSeatingChart(currentChart.id, { students: updatedStudents });
    setSelectedSeat(null);
    showToast('Seat cleared', 'info');
  };

  const handleCreateNewChart = (layout: SeatingChart['layoutType']) => {
    const created = storage.addSeatingChart({
      title: `New ${layout === 'risers' ? 'Choir Risers' : 'Music Room'} Chart`,
      grade: 'All',
      layoutType: layout,
      rowsCount: 3,
      seatsPerRow: layout === 'risers' ? 12 : 8,
      teacherDeskPosition: 'front-center',
      pianoPosition: 'left',
      instrumentCartPosition: 'front-right',
      students: []
    });
    setSelectedChartId(created.id);
    showToast('New seating chart layout created', 'success');
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-stone-200 dark:border-stone-800">
        <div>
          <h1 className="text-2xl font-extrabold text-stone-900 dark:text-white flex items-center gap-2.5">
            <Grid className="w-6 h-6 text-brand-600" />
            <span>Classroom & Choir Seating Charts</span>
          </h1>
          <p className="text-xs sm:text-sm text-stone-500 dark:text-stone-400 mt-0.5">
            Semi-circle music room layouts, 3-step choir risers, privacy-friendly student initials, and printable cards.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleCreateNewChart('semicircle')}
            className="px-3.5 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 text-stone-800 dark:text-stone-200 text-xs font-bold transition-all"
          >
            + Semi-Circle
          </button>
          <button
            onClick={() => handleCreateNewChart('risers')}
            className="px-3.5 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 text-stone-800 dark:text-stone-200 text-xs font-bold transition-all"
          >
            + Choir Risers
          </button>
          <button
            onClick={() => window.print()}
            className="px-4 py-2 rounded-xl bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 text-xs font-bold flex items-center gap-1.5 shadow-sm"
          >
            <Printer className="w-4 h-4" />
            <span>Print Chart</span>
          </button>
        </div>
      </div>

      {currentChart ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Main Visual Seating Canvas */}
          <div className="lg:col-span-8 bg-white dark:bg-stone-900 rounded-3xl p-6 sm:p-8 shadow-card border border-stone-200/80 dark:border-stone-800 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-stone-100 dark:border-stone-800">
              <div>
                <select
                  value={currentChart.id}
                  onChange={(e) => setSelectedChartId(e.target.value)}
                  className="text-base font-bold bg-transparent text-stone-900 dark:text-white border-none focus:outline-none cursor-pointer"
                >
                  {charts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-stone-400 capitalize">
                  Layout: {currentChart.layoutType} • {currentChart.students.length} students placed
                </p>
              </div>

              {/* Room Boundary Fixtures Indicators */}
              <div className="flex items-center gap-2 text-xs">
                <span className="px-2 py-1 rounded bg-stone-100 dark:bg-stone-800 font-semibold text-stone-600 dark:text-stone-400">
                  Piano: {currentChart.pianoPosition}
                </span>
                <span className="px-2 py-1 rounded bg-stone-100 dark:bg-stone-800 font-semibold text-stone-600 dark:text-stone-400">
                  Music Cart: {currentChart.instrumentCartPosition}
                </span>
              </div>
            </div>

            {/* Front Stage / Teacher Position Indicator */}
            <div className="w-full py-2.5 rounded-2xl bg-stone-100 dark:bg-stone-800 text-center font-bold text-xs uppercase tracking-wider text-stone-500 dark:text-stone-400 border border-stone-200/60 dark:border-stone-700">
              ▲ FRONT OF ROOM / TEACHER CART & SMARTBOARD ▲
            </div>

            {/* Visual Seats Grid Layout */}
            <div className="py-6 flex flex-col items-center justify-center space-y-4 overflow-x-auto">
              {Array.from({ length: currentChart.rowsCount }).map((_, rIdx) => {
                const isRiser = currentChart.layoutType === 'risers';
                const isSemicircle = currentChart.layoutType === 'semicircle';

                // Arc styling for semicircle
                const curveOffset = isSemicircle ? Math.pow(rIdx, 1.2) * 8 : 0;

                return (
                  <div
                    key={rIdx}
                    className={`flex items-center justify-center gap-2.5 sm:gap-3 transition-all ${
                      isRiser ? 'p-2 rounded-2xl bg-stone-100/60 dark:bg-stone-800/40 border border-stone-200/40' : ''
                    }`}
                    style={{
                      transform: isSemicircle ? `translateY(${curveOffset}px)` : 'none'
                    }}
                  >
                    <span className="text-[10px] font-mono text-stone-400 w-6 text-right">
                      R{rIdx + 1}
                    </span>

                    {Array.from({ length: currentChart.seatsPerRow }).map((_, cIdx) => {
                      const studentItem = currentChart.students.find(
                        (s) => s.row === rIdx && s.col === cIdx
                      );
                      const isSelected = selectedSeat?.row === rIdx && selectedSeat?.col === cIdx;

                      const isPart1 = studentItem?.student.voicePart === 'Part 1' || studentItem?.student.voicePart === 'Soprano';
                      const isPart2 = studentItem?.student.voicePart === 'Part 2' || studentItem?.student.voicePart === 'Alto';

                      return (
                        <button
                          key={cIdx}
                          onClick={() => handleSeatClick(rIdx, cIdx)}
                          className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex flex-col items-center justify-center text-center transition-all p-1 ${
                            isSelected
                              ? 'ring-4 ring-brand-500 scale-105 z-10 shadow-lg'
                              : 'hover:scale-105'
                          } ${
                            studentItem
                              ? isPart1
                                ? 'bg-rose-100 dark:bg-rose-950/80 text-rose-900 dark:text-rose-100 border border-rose-300 dark:border-rose-800'
                                : isPart2
                                ? 'bg-indigo-100 dark:bg-indigo-950/80 text-indigo-900 dark:text-indigo-100 border border-indigo-300 dark:border-indigo-800'
                                : 'bg-brand-50 dark:bg-brand-950/80 text-brand-900 dark:text-brand-100 border border-brand-200 dark:border-brand-800'
                              : 'bg-stone-100 dark:bg-stone-800/80 text-stone-400 border border-dashed border-stone-300 dark:border-stone-700 hover:border-brand-400'
                          }`}
                        >
                          {studentItem ? (
                            <>
                              <span className="font-bold text-xs truncate max-w-full leading-tight">
                                {studentItem.student.name}
                              </span>
                              {studentItem.student.voicePart ? (
                                <span className="text-[9px] font-mono opacity-75">
                                  {studentItem.student.voicePart === 'Part 1' ? 'P1' : 'P2'}
                                </span>
                              ) : (
                                <span className="text-[9px] font-mono text-stone-400">
                                  #{studentItem.student.seatNumber}
                                </span>
                              )}
                            </>
                          ) : (
                            <span className="text-[10px] font-mono opacity-50">+</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center justify-between text-xs text-stone-400 pt-4 border-t border-stone-100 dark:border-stone-800">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-full bg-rose-400 inline-block" />
                  Part 1 (Soprano)
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-full bg-indigo-400 inline-block" />
                  Part 2 (Alto)
                </span>
              </div>
              <span>Click any seat to assign student or voice part</span>
            </div>
          </div>

          {/* Right Column: Seat Inspector & Student Editor */}
          <div className="lg:col-span-4 bg-white dark:bg-stone-900 rounded-3xl p-6 shadow-card border border-stone-200/80 dark:border-stone-800 space-y-4">
            <h3 className="text-sm font-bold text-stone-900 dark:text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-brand-600" />
              Seat Assignment Inspector
            </h3>

            {selectedSeat ? (
              <div className="space-y-4">
                <span className="px-2.5 py-1 rounded-lg bg-stone-100 dark:bg-stone-800 text-xs font-mono font-bold block">
                  Row {selectedSeat.row + 1}, Seat {selectedSeat.col + 1}
                </span>

                <div>
                  <label className="text-xs font-bold uppercase text-stone-400 block mb-1">
                    Student Name or Initials
                  </label>
                  <input
                    type="text"
                    value={editingStudent.name || ''}
                    onChange={(e) => setEditingStudent({ ...editingStudent, name: e.target.value })}
                    placeholder="e.g. Maya S."
                    className="w-full text-xs px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold uppercase text-stone-400 block mb-1">
                    Voice Part (for Chorus Risers)
                  </label>
                  <select
                    value={editingStudent.voicePart || ''}
                    onChange={(e) => setEditingStudent({ ...editingStudent, voicePart: e.target.value as any })}
                    className="w-full text-xs px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl"
                  >
                    <option value="">General Music (Unassigned)</option>
                    <option value="Part 1">Part 1 (Soprano)</option>
                    <option value="Part 2">Part 2 (Alto)</option>
                    <option value="Soprano">Soprano</option>
                    <option value="Alto">Alto</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold uppercase text-stone-400 block mb-1">
                    Teaching / Accommodation Notes
                  </label>
                  <textarea
                    value={editingStudent.notes || ''}
                    onChange={(e) => setEditingStudent({ ...editingStudent, notes: e.target.value })}
                    rows={2}
                    placeholder="e.g. Needs front row for mallet reach; pitch anchor..."
                    className="w-full text-xs px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    onClick={handleSaveStudent}
                    className="flex-1 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-sm"
                  >
                    Save Seat
                  </button>
                  <button
                    onClick={handleClearSeat}
                    className="px-3 py-2 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-100 text-xs font-bold"
                  >
                    Clear
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-xs text-stone-400 py-8 text-center">
                Select a seat in the chart to inspect student notes or voice parts.
              </p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
};
