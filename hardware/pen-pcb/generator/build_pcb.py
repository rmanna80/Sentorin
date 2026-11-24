#!/usr/bin/env python3
"""Generate the smart-pen KiCad 7 board with the pcbnew API, then run DRC.

Board frame: x runs along the pen axis (x=0 is the module's antenna end),
y runs across the bore (board is 8.6 mm wide, centred on y=0).
"""
import json, math, os, sys
import pcbnew
from pcbnew import FromMM, ToMM, F_Cu, B_Cu

OUT = sys.argv[1] if len(sys.argv) > 1 else "."
PCB = os.path.join(OUT, "smartpen.kicad_pcb")
LIB = "/usr/share/kicad/footprints"

# ---- geometry ---------------------------------------------------------------
X0, X1 = -0.25, 11.1          # board extents along the pen axis
HW = 4.45                     # half width  -> 8.9 mm wide (rev 0.3: needs the 9.5 mm bore)
ANT = 3.2                     # antenna area length (Fanstel datasheet)
MOD_L, MOD_W = 8.8, 7.8

# ---- rules (JLCPCB 2-layer, conservative) -----------------------------------
CLR, TRK, PWR = 0.15, 0.15, 0.30
VIA_D, VIA_H = 0.60, 0.30
EDGE = 0.25


def V(x, y):
    return pcbnew.VECTOR2I(FromMM(x), FromMM(y))


if os.path.exists(PCB):
    os.remove(PCB)
board = pcbnew.NewBoard(PCB)
ds = board.GetDesignSettings()
ds.SetBoardThickness(FromMM(0.8))
ds.m_TrackMinWidth = FromMM(0.127)
ds.m_MinClearance = FromMM(0.127)
ds.m_ViasMinSize = FromMM(0.6)
ds.m_ViasMinAnnularWidth = FromMM(0.15)
ds.m_MinThroughDrill = FromMM(0.3)
ds.m_CopperEdgeClearance = FromMM(EDGE)
ds.m_HoleClearance = FromMM(0.2)
ds.m_HoleToHoleMin = FromMM(0.25)
ds.m_SolderMaskMinWidth = FromMM(0.0)
nc = ds.m_NetSettings.m_DefaultNetClass
nc.SetClearance(FromMM(CLR))
nc.SetTrackWidth(FromMM(TRK))
nc.SetViaDiameter(FromMM(VIA_D))
nc.SetViaDrill(FromMM(VIA_H))

NETS = {}


def net(name):
    if name not in NETS:
        n = pcbnew.NETINFO_ITEM(board, name)
        board.Add(n)
        NETS[name] = n
    return NETS[name]


# ---- netlist (single source of truth; the schematic generator imports it) ---
NETLIST = {
    "VBAT":     [("J1", "1"), ("Q1", "3")],
    "VDD":      [("Q1", "2"), ("U1", "16"), ("C1", "1"), ("C2", "1"), ("C3", "1"), ("TP4", "1")],
    "GND":      [("J2", "1"), ("Q1", "1"), ("U1", "1"), ("C1", "2"), ("C2", "2"), ("C3", "2"), ("TP5", "1")],
    "SWDIO":    [("U1", "3"), ("TP1", "1")],
    "SWDCLK":   [("U1", "4"), ("TP2", "1")],
    "DCC":      [("U1", "B3"), ("L1", "1")],
    "DCDC_MID": [("L1", "2"), ("L2", "1")],
    "DEC4":     [("L2", "2"), ("U1", "C3")],
}
PADNET = {(r, p): n for n, lst in NETLIST.items() for r, p in lst}

BC832_PINS = {
    "1": "GND", "2": "P0.20", "3": "SWDIO", "4": "SWDCLK", "5": "P0.18", "6": "P0.13",
    "7": "P0.11", "8": "P0.12", "9": "P0.03/AIN1", "10": "P0.21/RESET", "11": "P0.00/XL1",
    "12": "P0.01/XL2", "13": "P0.02/AIN0", "14": "P0.27", "15": "P0.26", "16": "VDD",
    "A1": "P0.28", "A2": "P0.17", "A3": "P0.04", "A4": "P0.06", "A5": "P0.08",
    "B1": "P0.25", "B2": "P0.29", "B3": "DCC", "B4": "P0.05", "B5": "P0.07",
    "C1": "P0.24", "C2": "P0.22", "C3": "DEC4", "C4": "P0.15", "C5": "P0.09/NFC1",
    "D1": "P0.23", "D2": "P0.19", "D3": "P0.16", "D4": "P0.14", "D5": "P0.10/NFC2",
}


def smd_pad(fp, num, x, y, w, h, shape, layer=F_Cu, paste=True):
    p = pcbnew.PAD(fp)
    p.SetNumber(num)
    p.SetAttribute(pcbnew.PAD_ATTRIB_SMD)
    p.SetShape(shape)
    p.SetSize(V(w, h))
    ls = pcbnew.LSET()
    ls.AddLayer(layer)
    ls.AddLayer(pcbnew.F_Mask if layer == F_Cu else pcbnew.B_Mask)
    if paste:
        ls.AddLayer(pcbnew.F_Paste if layer == F_Cu else pcbnew.B_Paste)
    p.SetLayerSet(ls)
    p.SetPosition(V(x, y)); p.SetPos0(V(x, y))
    fp.Add(p)
    return p


def fab_rect(fp, x0, y0, x1, y1, layer):
    for a, b in (((x0, y0), (x1, y0)), ((x1, y0), (x1, y1)), ((x1, y1), (x0, y1)), ((x0, y1), (x0, y0))):
        s = pcbnew.FP_SHAPE(fp)
        s.SetShape(pcbnew.SHAPE_T_SEGMENT)
        s.SetStart(V(*a)); s.SetEnd(V(*b)); s.SetStart0(V(*a)); s.SetEnd0(V(*b))
        s.SetLayer(layer); s.SetWidth(FromMM(0.05 if layer in (pcbnew.F_CrtYd, pcbnew.B_CrtYd) else 0.1))
        fp.Add(s)


def new_fp(ref, value, name):
    fp = pcbnew.FOOTPRINT(board)
    fp.SetReference(ref); fp.SetValue(value)
    fp.SetFPID(pcbnew.LIB_ID("smartpen", name))
    fp.SetAttributes(pcbnew.FP_SMD)
    fp.Reference().SetVisible(False); fp.Value().SetVisible(False)
    fp.Reference().SetLayer(pcbnew.F_Fab); fp.Value().SetLayer(pcbnew.F_Fab)
    board.Add(fp)
    return fp


def make_bc832():
    """Land pattern cross-checked against two independent community footprints
    (pitch 1.1 mm castellated, 1.2 mm LGA).  NOT yet checked against Fanstel's
    own drawing.  Castellated lands are shortened to a 0.15 mm toe so the board
    fits the 9.14 mm bore -> reflow only."""
    fp = new_fp("U1", "BC832 (V1)", "BC832_V1_pen")
    for i in range(8):
        fy = -3.918 + 1.1 * i
        # rev 0.3: heel (3.25) and width (0.70) per Fanstel EV Gerbers as measured by the owner; toe cut from 4.55 to 4.20
        smd_pad(fp, str(i + 1), -3.725, fy, 0.95, 0.70, pcbnew.PAD_SHAPE_RECT)
        smd_pad(fp, str(16 - i), 3.725, fy, 0.95, 0.70, pcbnew.PAD_SHAPE_RECT)
    for c, col in enumerate("ABCD"):
        for r in range(5):
            smd_pad(fp, f"{col}{r+1}", -1.75 + 1.2 * c, -0.919 + 1.2 * r, 0.6, 0.6, pcbnew.PAD_SHAPE_CIRCLE)
    fab_rect(fp, -3.9, -4.4, 3.9, 4.4, pcbnew.F_Fab)
    fab_rect(fp, -3.9, -4.4, 3.9, -1.2, pcbnew.F_Fab)        # antenna area
    fab_rect(fp, -4.25, -4.4, 4.25, 4.4, pcbnew.F_CrtYd)
    return fp


def make_pad_fp(ref, value, name, w, h, shape, layer):
    fp = new_fp(ref, value, name)
    smd_pad(fp, "1", 0, 0, w, h, shape, layer=F_Cu, paste=False)
    fp.SetAttributes(pcbnew.FP_SMD | pcbnew.FP_EXCLUDE_FROM_BOM | pcbnew.FP_EXCLUDE_FROM_POS_FILES)
    if layer == B_Cu:
        fp.Flip(V(0, 0), False)
    return fp


def lib_fp(ref, value, lib, name, bottom):
    fp = pcbnew.FootprintLoad(os.path.join(LIB, lib + ".pretty"), name)
    fp.SetReference(ref); fp.SetValue(value)
    fp.Reference().SetVisible(False); fp.Value().SetVisible(False)
    fp.SetFPID(pcbnew.LIB_ID("smartpen", name))   # rev 0.3: all footprints live in the project library
    for g in list(fp.GraphicalItems()):
        if g.GetLayer() in (pcbnew.F_SilkS, pcbnew.B_SilkS):
            fp.Remove(g)
    board.Add(fp)
    if bottom:
        fp.Flip(fp.GetPosition(), False)
    return fp


def place(fp, x, y, rot=0):
    fp.SetPosition(V(x, y))
    fp.SetOrientationDegrees(rot)


def assign_nets(fp):
    ref = fp.GetReference()
    for p in fp.Pads():
        n = PADNET.get((ref, p.GetNumber()))
        if n:
            p.SetNet(net(n))


def pp(ref, num):
    fp = board.FindFootprintByReference(ref)
    for p in fp.Pads():
        if p.GetNumber() == num:
            pos = p.GetPosition()
            return (ToMM(pos.x), ToMM(pos.y))
    raise KeyError((ref, num))


def track(netname, pts, layer, w=TRK):
    for a, b in zip(pts, pts[1:]):
        t = pcbnew.PCB_TRACK(board)
        t.SetStart(V(*a)); t.SetEnd(V(*b))
        t.SetWidth(FromMM(w)); t.SetLayer(layer); t.SetNet(net(netname))
        board.Add(t)


def via(netname, x, y):
    v = pcbnew.PCB_VIA(board)
    v.SetViaType(pcbnew.VIATYPE_THROUGH)
    v.SetPosition(V(x, y)); v.SetWidth(FromMM(VIA_D)); v.SetDrill(FromMM(VIA_H))
    v.SetLayerPair(F_Cu, B_Cu); v.SetNet(net(netname))
    board.Add(v)
    return (x, y)


# ---- outline ----------------------------------------------------------------
for a, b in (((X0, -HW), (X1, -HW)), ((X1, -HW), (X1, HW)), ((X1, HW), (X0, HW)), ((X0, HW), (X0, -HW))):
    s = pcbnew.PCB_SHAPE(board)
    s.SetShape(pcbnew.SHAPE_T_SEGMENT)
    s.SetStart(V(*a)); s.SetEnd(V(*b)); s.SetLayer(pcbnew.Edge_Cuts); s.SetWidth(FromMM(0.05))
    board.Add(s)

# ---- placement --------------------------------------------------------------
u1 = make_bc832()
place(u1, MOD_L / 2, 0, 90)
if pp("U1", "1")[0] > 4:                 # antenna end must sit at x = 0
    place(u1, MOD_L / 2, 0, -90)
s1 = 1 if pp("U1", "1")[1] > 0 else -1   # side of the board carrying pins 1-8
s16 = -s1

c3 = lib_fp("C3", "100n", "Capacitor_SMD", "C_0402_1005Metric", True)
l1 = lib_fp("L1", "10u", "Inductor_SMD", "L_0603_1608Metric", True)
l2 = lib_fp("L2", "15n", "Inductor_SMD", "L_0402_1005Metric", True)
c1 = lib_fp("C1", "47u", "Capacitor_SMD", "C_0805_2012Metric", True)
c2 = lib_fp("C2", "47u", "Capacitor_SMD", "C_0805_2012Metric", True)
q1 = lib_fp("Q1", "AO3401A", "Package_TO_SOT_SMD", "SOT-23", True)      # rev 0.2: bottom side
tp = {}
for n, label in (("1", "SWDIO"), ("2", "SWDCLK"), ("4", "VDD"), ("5", "GND")):
    tp[n] = make_pad_fp("TP" + n, label, "TestPad_D1.0mm", 1.0, 1.0, pcbnew.PAD_SHAPE_CIRCLE, B_Cu)
j1 = make_pad_fp("J1", "BAT+", "BatteryPad_1.2x3.0mm", 1.2, 3.0, pcbnew.PAD_SHAPE_RECT, F_Cu)   # rev 0.2: top rear strip
j2 = make_pad_fp("J2", "BAT-", "BatteryPad_1.2x3.0mm", 1.2, 3.0, pcbnew.PAD_SHAPE_RECT, F_Cu)


def orient(fp, x, y, pad, want_sign, axis=1):
    for rot in (90, 270):
        place(fp, x, y, rot)
        c = fp.GetPosition()
        p = pp(fp.GetReference(), pad)
        d = p[axis] - ToMM(c.y if axis == 1 else c.x)
        if d * want_sign > 0:
            return
    raise RuntimeError("orient " + fp.GetReference())


assert s1 == 1, "layout below is written for pins 1-8 on the +y side"
orient(c3, 4.45, -1.55, "1", -1)
orient(l1, 5.6, 1.5, "1", 1)
orient(l2, 5.6, -1.0, "1", 1)
orient(c1, 7.5, -1.05, "1", -1)
orient(c2, 9.5, -1.05, "1", -1)
place(q1, 8.7, 2.4, 0)
qg, qs, qd = pp("Q1", "1"), pp("Q1", "2"), pp("Q1", "3")
assert qs[1] < qg[1] and qd[0] > qs[0], "Q1: source must be inboard, drain to the rear"
place(tp["1"], 5.2, 3.4); place(tp["2"], 4.45, 2.2)
place(tp["4"], 7.6, -3.3); place(tp["5"], 9.8, -3.2)
place(j1, 10.25, 2.1); place(j2, 10.25, -2.1)

for fp in board.GetFootprints():
    assign_nets(fp)

# ---- routing: top -----------------------------------------------------------
u = lambda n: pp("U1", n)
g = u("1"); vg = via("GND", 2.6, 2.15)
track("GND", [g, (g[0], 2.15), vg], F_Cu)
a = u("3"); vio = via("SWDIO", 3.55, 2.75)            # rev 0.2: via moved out of the antenna strip
track("SWDIO", [a, (a[0], 3.2), vio], F_Cu)
a = u("4"); vck = via("SWDCLK", 4.45, 2.75)
track("SWDCLK", [a, (a[0], 3.35), (4.0, 3.15), vck], F_Cu)
a = u("16"); vv = via("VDD", 3.9, -2.75)              # rev 0.2: VDD drops to the bottom here; no lane under pins 9-13
track("VDD", [a, (a[0], -2.95), (3.6, -2.95), vv], F_Cu)
b3 = u("B3"); vdcc = via("DCC", 6.481, 2.7)
track("DCC", [b3, (6.481, b3[1]), vdcc], F_Cu)
c3p = u("C3"); vdec = via("DEC4", 5.281, -2.5)
track("DEC4", [c3p, (5.281, c3p[1]), vdec], F_Cu)
vbat = via("VBAT", 10.5, 1.3)                        # inside the BAT+ pad
vgnd = via("GND", 10.55, -3.2)                       # inside the BAT- pad

# ---- routing: bottom --------------------------------------------------------
track("GND", [vg, (3.3, 2.15), (3.6, 1.85), (3.6, -1.07), pp("C3", "2")], B_Cu, 0.2)
track("GND", [(3.6, 1.42), (6.4, 1.42)], B_Cu, 0.18)   # explicit bridge under L1 into the main pour
track("SWDIO", [vio, (3.95, 3.45), (4.6, 3.45), pp("TP1", "1")], B_Cu)
track("SWDCLK", [vck, pp("TP2", "1")], B_Cu)
track("VDD", [vv, pp("C3", "1")], B_Cu, 0.25)
track("VDD", [vv, (4.7, -3.6), (8.5, -3.6)], B_Cu, 0.25)
track("VDD", [(8.5, -3.6), (8.5, qs[1]), qs], B_Cu, 0.2)
track("VDD", [(7.6, -3.6), pp("TP4", "1")], B_Cu, 0.25)
a1, a2 = pp("C1", "1"), pp("C2", "1")
track("VDD", [a1, (8.5, a1[1]), a2], B_Cu, 0.25)
track("DCC", [vdcc, pp("L1", "1")], B_Cu)
track("DCDC_MID", [pp("L1", "2"), pp("L2", "1")], B_Cu)
track("DEC4", [pp("L2", "2"), vdec], B_Cu)
track("VBAT", [qd, (10.5, qd[1]), vbat], B_Cu, PWR)

# ---- zones ------------------------------------------------------------------
def zone(layer, netname, pts):
    z = pcbnew.ZONE(board)
    z.SetLayer(layer)
    if netname:
        z.SetNet(net(netname))
    o = z.Outline(); o.NewOutline()
    for x, y in pts:
        o.Append(FromMM(x), FromMM(y))
    board.Add(z)
    return z


ZI = 0.3   # rev 0.3: pour outline inset from the board edge (KiCad 7 scripted fill ignored the edge-clearance rule)
gz = zone(B_Cu, "GND", [(ANT + 0.25, -HW + ZI), (X1 - ZI, -HW + ZI), (X1 - ZI, HW - ZI), (ANT + 0.25, HW - ZI)])
gz.SetLocalClearance(FromMM(0.15)); gz.SetMinThickness(FromMM(0.13))
gz.SetPadConnection(pcbnew.ZONE_CONNECTION_FULL)
gz.SetIslandRemovalMode(pcbnew.ISLAND_REMOVAL_MODE_ALWAYS)

CU2 = pcbnew.LSET(); CU2.AddLayer(F_Cu); CU2.AddLayer(B_Cu)
# strict antenna keep-out: nothing at all on either copper layer
ko = zone(F_Cu, None, [(X0, -1.7), (ANT - 0.1, -1.7), (ANT - 0.1, 1.7), (X0, 1.7)])   # stops 0.1 mm short: 0.6 mm LGA lands of row 1 reach x = 3.18
ko.SetIsRuleArea(True); ko.SetLayerSet(CU2)
ko.SetDoNotAllowCopperPour(True); ko.SetDoNotAllowTracks(True)
ko.SetDoNotAllowVias(True); ko.SetDoNotAllowPads(True); ko.SetDoNotAllowFootprints(False)
ko.SetZoneName("ANT_KEEPOUT_STRICT")
# whole antenna strip: no pour (the six module pins that sit here still need lands/tracks)
ko2 = zone(F_Cu, None, [(X0, -HW), (ANT, -HW), (ANT, HW), (X0, HW)])
ko2.SetIsRuleArea(True); ko2.SetLayerSet(CU2)
ko2.SetDoNotAllowCopperPour(True); ko2.SetDoNotAllowTracks(False)
ko2.SetDoNotAllowVias(False); ko2.SetDoNotAllowPads(False); ko2.SetDoNotAllowFootprints(False)
ko2.SetZoneName("ANT_NO_POUR")

board.BuildConnectivity()
pcbnew.ZONE_FILLER(board).Fill(board.Zones())
board.BuildConnectivity()
bbz = gz.GetFilledPolysList(B_Cu).BBox()
assert ToMM(bbz.GetTop()) >= -HW + EDGE and ToMM(bbz.GetBottom()) <= HW - EDGE and ToMM(bbz.GetRight()) <= X1 - EDGE, 'pour too close to edge'
pcbnew.SaveBoard(PCB, board)

# ---- DRC --------------------------------------------------------------------
rpt = os.path.join(OUT, "validation", "drc_report.txt")
os.makedirs(os.path.dirname(rpt), exist_ok=True)
pcbnew.WriteDRCReport(board, rpt, pcbnew.EDA_UNITS_MILLIMETRES, True)
import re
R=open(rpt).read()
print(R if len(R)<6000 else R[:6000])
print('COUNTS', re.findall(r'Found \d+ [^*]*', R))
json.dump({"netlist": NETLIST, "bc832_pins": BC832_PINS, "s1": s1}, open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "netlist.json"), "w"), indent=1)
for fp in board.GetFootprints():
    bb = [(p.GetNumber(), round(ToMM(p.GetPosition().x), 3), round(ToMM(p.GetPosition().y), 3)) for p in fp.Pads()][:4]
    print(fp.GetReference(), "B" if fp.IsFlipped() else "F", bb)
