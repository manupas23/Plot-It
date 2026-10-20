# Plot.It

Data analysis and plotting in the browser, in the spirit of [SciDAVis](https://scidavis.sourceforge.net/) and Origin: tables with column formulas, publication-quality graphs and nonlinear curve fitting with parameter errors.

Nothing to install and no server: your data stay in your browser and are never uploaded anywhere. The interface is available in English and Spanish (ES/EN switch in the top bar).

## Usage

Open `index.html` in Chrome, Edge or Firefox.

1. **Get data into a table.**
   - Click a cell and type (`Enter` / `Tab` move on, `F2` or a double-click edits a cell). Decimal commas are accepted.
   - Paste from Excel, LibreOffice or SciDAVis with `Ctrl+V`. If you paste at row 1 and the first line holds titles, they become the column names.
   - Right-click a column header or a row number to insert or delete columns and rows, and drag a header to move its column.
   - Or **Import data** (or drop files onto the page): CSV, TXT, DAT and LAMMPS logs, see [Import](#import).
2. **Set the column roles.** Each column is X, Y, X error, Y error or none (*Column* panel). A Y column is plotted against the nearest X column on its left, and takes the error columns that follow it. Columns named `err`, `sd`, `sigma`, `x_err`… or `dE` right after `E` are marked as Y errors on import.
3. **Compute new columns** with a formula (*Set values from a formula*), sort, normalize, differentiate or integrate (*Operations*). The *Statistics* panel summarises the selection.
4. **Plot.** Select one or more Y columns (click their headers, `Ctrl`+click for several) and press *Plot*, into a new graph or an existing one. In the graph, the *Curves* panel changes colours, symbols, lines and error columns, and adds more data or functions $f(x)$.
5. **Fit.** In the *Fit* panel choose the data and a model, or write your own expression. `Shift`+drag on the graph limits the $x$ range. *Fit* draws the curve and shows the parameters with their errors and relative errors, $\chi^2/\nu$, $R^2$ (outlined in red when it is below 0.9) and RMSE. Each fit is stored with its curve (and saved with the project), so the results of every fit on a graph can be looked up at any time from the list in the *Fit* panel, without fitting again; selecting a fit curve in the *Curves* panel also shows its result. Fitting the same model again over the same range replaces the previous fit; over another range it is kept separately. Click a value to copy it with all its digits. *Copy* gives the result as text, *Residuals → table* writes $x$, $y$, the fitted value and the residual of each point, and *Delete fit* removes the fit and its curve. The text of each fit also goes to the *Results log*, which stays closed unless you open it.
6. **Analyse.** The *Analysis* menu in the top bar holds the FFT, FFT filters, smoothing, interpolation, correlation, histograms and peak finding, see [Analysis](#analysis). Each tool opens a dialog with the selected column or curve already chosen, writes its result to a new column or table, can plot it, and leaves a summary in the *Results log*.
7. **Format and export.** The side panel holds the quick settings; the detailed ones are in the *Graph* menu, see [Graph and curve format](#graph-and-curve-format). The white page is exactly what gets exported: set its size, font size, titles, axis ranges, log scales, grid and legend in *Axes and layout*, then press *PNG* (1–4× scale) or *SVG*. Tables are exported with *Export CSV* (standard, or with `;` and a decimal comma for Excel in Spanish and other European locales).
8. **Save.** *Save project* (`Ctrl+S`) writes a `.plotit.json` file with every table, graph and the log; *Open project* loads it back. Your work is also kept automatically in the browser, and offered back when you open Plot.It again.

In graphs: mouse wheel to zoom (`Shift`: $x$ only, `Alt`: $y$ only), drag to pan, double-click or `A` to autoscale, and hover over a point to read its row and values. A double-click on the axes or the margins opens the graph format. Right-click the graph for the *Analysis* and *Graph* menus, *Open image in new tab* and *Save image as…* (PNG or SVG, in the folder you choose); right-clicking a point first selects its curve.

Tabs are reordered by dragging them. The screen can be split into two windows, each with its own tabs, as in VS Code: drag a tab past two thirds of the width (a dashed box shows where the new window will go) and drop it, or press the split button next to *+ Graph*, use *View → Split into two windows*, or right-click a tab and choose *Open beside*. Drag tabs from one window to the other (onto its tab bar or its content) to move them; when a window is left without tabs, the screen goes back to one. New tables and graphs open in the window with the focus. You work in the window with the blue line; the other one is redrawn on every change, and a click on it gives it the focus (in a table, the clicked cell is selected). Drag the bar in the middle to share the space (double-click for half and half, or the arrow keys); *View → Swap sides* exchanges them. On narrow screens the two windows are stacked.

### Formulas

| | |
|---|---|
| Operators | `+ - * / ^ %` (`**` also works for powers), comparisons `< > <= >= == !=` (giving 1 or 0), `&&`, `\|\|`, `!`, `cond ? a : b` |
| Functions | `sin cos tan asin acos atan atan2 sinh cosh tanh asinh acosh atanh exp ln log` (base 10) `log10 log2 sqrt cbrt abs sign floor ceil round min max hypot pow mod erf erfc gamma rand if` |
| Constants | `pi`, `e` |
| Columns | by name (`B*2`), or `col("name with spaces")`; `cell("A", i-1)` reads another row |
| Row | `i` (1, 2, 3…) |

For example, `A^2 + cell("B", i-1)` or, in a column next to `T` and `E`, `E/T`. Rows where the formula does not give a number are left empty. In fit models and functions the variable is `x`.

### Rich text in titles and legends

`x_{0}` gives a subscript and `m^{2}` or `s^-1` a superscript (subscripts need braces, so names like `E_pair` are left alone). Greek letters and symbols are written as in LaTeX: `\alpha`, `\Delta`, `\mu`, `\AA` (Å), `\deg` (°), `\pm`, `\times`, `\cdot`, `\propto`, `\approx`, `\leq`, `\infty`…

### Fit models

| Model | Expression |
|---|---|
| Linear | `a*x + b` |
| Polynomial (degree 1–9) | `a0 + a1*x + a2*x^2 + …` |
| Exponential decay | `y0 + A*exp(-x/t)` |
| Exponential growth | `y0 + A*exp(x/t)` |
| Gaussian | `y0 + A*exp(-(x - xc)^2/(2*w^2))` |
| Lorentzian | `y0 + A/(1 + ((x - xc)/w)^2)` |
| Sigmoid (Boltzmann) | `A2 + (A1 - A2)/(1 + exp((x - x0)/dx))` |
| Power law | `A*x^b` |
| Sine | `y0 + A*sin(2*pi*x/T + phi)` |
| Damped oscillation | `y0 + A*exp(-x/tau)*sin(2*pi*x/T + phi)` |

Each built-in model estimates its own initial values from the data (*Guess* recomputes them). In a custom model every name other than `x` is a parameter; tick *Fixed* to keep a parameter at its value.

### Graph and curve format

*Graph → Graph format* (or *More options…* in *Axes and layout*) has four tabs, and the graph changes while you choose; *Cancel* or `Esc` puts it back as it was.

| Tab | Options |
|---|---|
| Axes (X and Y side by side) | title, range, log scale, tick step, number of minor ticks, ticks in, out, crossing the axis or none, ticks also on the opposite side, numbers automatic, decimal or scientific ($\times 10^n$), number of decimals, hide the numbers |
| Frame and grid | closed box, X and Y axes only or no frame; axis line width; tick length; major and minor grid and its colour |
| Text and legend | title, font (Arial, Helvetica, Calibri, Verdana, Times, Georgia, monospace), font size, relative sizes of the title, tick numbers and legend, legend position and frame |
| Page | width and height in pixels, background colour or transparent background (PNG and SVG) |

*Graph → Curve format* (or *More options…* in *Curves*) edits one curve at a time: style (points, line, line and points, bars), 12 symbols (circle, square, triangles in four directions, diamond, cross, plus, star, pentagon, hexagon), solid or hollow, fill colour and opacity, edge width, points joined with straight lines, steps or a smooth curve (Catmull–Rom spline through the points), line width and dash, error-bar width, cap and colour, and bar width as a fraction of the spacing between points.

## Calculations

### Least-squares fit

The parameters $\mathbf p$ minimise

```math
\chi^2(\mathbf p) = \sum_{i=1}^{n} \left(\frac{y_i - f(x_i;\mathbf p)}{\sigma_i}\right)^2
```

with $\sigma_i$ the Y errors when *Weight with Y errors* is ticked (all of them must be positive), and $\sigma_i = 1$ otherwise. The minimum is found with the **Levenberg–Marquardt** method: at each step it solves

```math
\left(\mathbf J^\mathsf{T}\mathbf W\mathbf J + \lambda\,\operatorname{diag}\!\big(\mathbf J^\mathsf{T}\mathbf W\mathbf J\big)\right)\delta\mathbf p = \mathbf J^\mathsf{T}\mathbf W\,\big(\mathbf y - \mathbf f(\mathbf p)\big)
```

where $J_{ik} = \partial f(x_i;\mathbf p)/\partial p_k$ is computed with centred differences, $\mathbf W = \operatorname{diag}(1/\sigma_i^2)$, and $\lambda$ is divided by 10 after a step that lowers $\chi^2$ and multiplied by 10 otherwise. Scaling by the diagonal makes the method insensitive to the size of each parameter. It stops when $\chi^2$ no longer decreases (relative change below $10^{-12}$). Fixed parameters are left out of $\mathbf J$.

The covariance matrix of the free parameters and their errors are

```math
\mathbf C = s\,\big(\mathbf J^\mathsf{T}\mathbf W\mathbf J\big)^{-1},
\qquad
\Delta p_k = \sqrt{C_{kk}}
```

With weights, $s = 1$: the errors come from the $\sigma_i$. Without weights, $s = \chi^2/\nu$, which estimates the scatter of the points from the residuals themselves. In both cases $\nu = n - k$ are the degrees of freedom ($k$ free parameters). Values are reported rounded to two significant digits of their error.

The goodness of fit is given by

```math
\chi^2_\nu = \frac{\chi^2}{\nu},
\qquad
R^2 = 1 - \frac{\sum_i \big(y_i - \hat y_i\big)^2}{\sum_i \big(y_i - \bar y\big)^2},
\qquad
R^2_\text{adj} = 1 - \big(1 - R^2\big)\frac{n - 1}{\nu},
\qquad
\text{RMSE} = \sqrt{\frac{\sum_i \big(y_i - \hat y_i\big)^2}{\nu}}
```

with $\hat y_i = f(x_i;\mathbf p)$. In a weighted fit, $\chi^2_\nu \approx 1$ means the curve agrees with the data within their errors; much larger values point to underestimated errors or a wrong model.

### Derivative

*d/dX* differentiates a Y column with respect to its X column, using only the rows where both are numbers. Inside, it uses the second-order centred difference for unequal steps, with $h_1 = x_i - x_{i-1}$ and $h_2 = x_{i+1} - x_i$:

```math
y'_i = \frac{h_1^2\,(y_{i+1} - y_i) + h_2^2\,(y_i - y_{i-1})}{h_1 h_2\,(h_1 + h_2)}
```

which for a constant step reduces to $(y_{i+1} - y_{i-1})/2h$. At the first and last points it uses the one-sided difference with the neighbouring point, $(y_2 - y_1)/(x_2 - x_1)$ and $(y_n - y_{n-1})/(x_n - x_{n-1})$.

### Integral

*∫ dX* writes the cumulative integral with the trapezoid rule, starting at 0 on the first valid row:

```math
I_j = \sum_{i=2}^{j} \frac{y_i + y_{i-1}}{2}\,\big(x_i - x_{i-1}\big)
```

The total area $I_n$ is shown and written to the *Results log*.

### Statistics

For the $N$ numbers in the selection: mean $\bar y$, sample standard deviation $s = \sqrt{\sum (y_i - \bar y)^2/(N-1)}$, standard error of the mean $s/\sqrt N$, minimum, maximum, sum and median. *Normalize* divides a column by its largest absolute value.

### Analysis

All the tools use the rows where both X and the column are numbers (with no X column, X is the row number). The pairs are sorted by X, and repeated X values are averaged.

**FFT.** For $N$ points with constant step $\Delta x$ (if the steps are not equal, the data are first resampled on $N$ equal steps by linear interpolation), the mean is subtracted (optional), the window $w_k$ is applied and

```math
X_m = \sum_{k=0}^{N-1} w_k\,y_k\,e^{-2\pi i\,km/N},
\qquad
f_m = \frac{m}{N\,\Delta x},\quad m = 0,\dots,\lfloor N/2\rfloor
```

is computed for any $N$ (radix 2 when $N$ is a power of two, Bluestein's algorithm otherwise, so there is no zero padding). The one-sided amplitude and power spectral density are

```math
A_m = \frac{c_m\,|X_m|}{\sum_k w_k},
\qquad
\text{PSD}_m = \frac{c_m\,|X_m|^2\,\Delta x}{\sum_k w_k^2}
```

with $c_m = 1$ at $f = 0$ and at the Nyquist frequency $1/(2\Delta x)$ and $c_m = 2$ elsewhere, so a sine of amplitude $A$ gives a peak of height $A$, and with the rectangular window $\sum_m \text{PSD}_m\,\Delta f$ is the variance of the data (Parseval). The phase is $\arg X_m$ in degrees. The windows are Hann $0.5 - 0.5\cos\frac{2\pi k}{N-1}$, Hamming $0.54 - 0.46\cos\frac{2\pi k}{N-1}$ and Blackman $0.42 - 0.5\cos\frac{2\pi k}{N-1} + 0.08\cos\frac{4\pi k}{N-1}$. The main peak (leaving out $f = 0$) is refined with a parabola through its two neighbours, and its frequency and period are written to the log.

**FFT filter.** It needs equal X steps. The straight line joining the first and last points is subtracted (so the FFT, which treats the data as periodic, does not see a jump), every coefficient whose frequency $\min(m, N-m)/(N\Delta x)$ is outside the pass band is set to zero, the inverse FFT is taken and the line is added back if the filter keeps $f = 0$. Low-pass keeps $f \le f_1$, high-pass $f \ge f_1$, band-pass $f_1 \le f \le f_2$, and band-stop removes $f_1 < f < f_2$. The cut is sharp, so expect some ringing next to steps in the data.

**Smoothing.** The moving average replaces each point with the mean of the $w$ points centred on it (fewer at the ends). Savitzky–Golay fits, by least squares, a polynomial of degree $p$ to the $w$ points around each $x_i$ and takes its value at $x_i$. The fit uses the real $x$ values, so it also works with unequal steps, and at the ends the window is shifted inwards instead of shortened. With $p \ge 2$ it keeps the height and width of peaks much better than the moving average.

**Interpolation.** The curve is evaluated at $n$ equally spaced points between *From* and *To* (by default, the data range), with straight lines between the data or with a natural cubic spline: piecewise cubics with continuous first and second derivatives and zero second derivative at both ends.

**Correlation.** With $a'_i = a_i - \bar a$ and $b'_i = b_i - \bar b$,

```math
r(k) = \frac{\sum_i a'_i\,b'_{i+k}}{\sqrt{\sum_i a'^2_i\,\sum_i b'^2_i}}
```

computed with the FFT and zero padding (no circular wrap-around). The lag is $k\,\Delta x$ when the steps are equal, and $k$ rows otherwise. For the autocorrelation ($b = a$, $r(0) = 1$) the log gives the first zero, the lag where $r$ falls below $1/e$ and the correlation time $\int r\,\mathrm d\tau$ up to the first zero (trapezoids). For the cross-correlation, it gives the largest $|r|$ and its lag; a positive lag means $b$ follows $a$.

**Histogram.** Equal bins between the smallest and largest value (or *From* and *To*); the largest value falls in the last bin. Without a number of bins, the width follows the Freedman–Diaconis rule $h = 2\,\text{IQR}\,N^{-1/3}$, or Sturges' rule ($\lceil\log_2 N\rceil + 1$ bins) when the interquartile range is zero. The table has the bin centres, the counts and the probability density $n_j/(N_\text{in}\,h)$, which integrates to 1.

**Peaks.** A peak is a point higher than its neighbours (a flat top counts once). Its *prominence* is its height above the higher of the two lowest points that separate it from a higher point on each side (or from the end of the data); its *width* is measured at half the prominence, interpolating linearly between points. Peaks below the minimum prominence (a percentage of the $y$ range) are dropped, and of two peaks closer than the minimum distance in $x$ the more prominent one is kept. Minima are found as the peaks of $-y$.

### Import

Each line is split with every candidate delimiter (tab, `;`, `,` and runs of spaces), and the one that gives the most lines with the same number of numeric fields wins. Decimal commas are accepted unless `,` is the delimiter; `nan` and `inf` become empty cells, and lines starting with `#`, `%`, `//` or `!` are comments. The data are the longest block of consecutive numeric lines, and its header is the non-numeric line just above it with the same number of fields (a commented header such as `# x y err` counts). Other blocks with the same header are appended, so a LAMMPS log with several `run` commands gives one table with all the thermo output, and the text in between (warnings, loop times) is skipped.

## Shortcuts

| Key | Action |
|---|---|
| Arrows, `PgUp` `PgDn`, `Home` `End` | Move around the table (`Ctrl`: to the edge of the data; `Shift`: extend the selection) |
| `Enter` / `Tab` | Next row / next column |
| `F2` | Edit the current cell |
| `Del` | Clear the selection |
| `Ctrl+C` / `Ctrl+X` / `Ctrl+V` | Copy / cut / paste (tab-separated, compatible with spreadsheets) |
| `Ctrl+A` | Select the whole table |
| Double-click a column name or unit | Edit it in place (`Enter` saves, `Esc` cancels, `Tab` goes to the next column) |
| Drag a column header | Move the column, or the selected block of columns (`Esc` cancels; `Shift`+drag selects a range) |
| Right-click a column header | Rename, new column to the left / right, delete |
| Right-click a row number | New row above / below, delete (as many rows as are selected) |
| Right-click the blank area of a table | New column at the end, new table, new graph |
| Wheel, drag, double-click | Zoom, pan and autoscale a graph |
| Double-click on the axes or margins | Graph format |
| Right-click on a graph | Analysis and Graph menus, open or save the image |
| `Shift`+drag | Set the fit range on a graph |
| `A` | Autoscale the graph |
| `Ctrl+S` | Save the project |
| `Ctrl+Z` / `Ctrl+Y` | Undo / redo |
| `?` | Help |

Double-click a tab to rename it; middle-click to close it; drag it to reorder it or to move it to the other window; right-click it to open it beside, move it to the other window, rename it or close it.
