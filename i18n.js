'use strict';
// Textos de la interfaz en español e inglés. t('clave', { var }) devuelve el texto del idioma
// activo; los valores pueden ser funciones (plurales). En el HTML, los elementos llevan
// data-i18n (texto), data-i18n-html (con marcado), data-i18n-title, data-i18n-aria y
// data-i18n-placeholder.

const I18N = {
  es: {
    meta_desc: 'Análisis de datos y gráficas en el navegador: tablas con fórmulas, gráficas para artículos y ajustes no lineales.',
    lang_t: 'Idioma',
    import: 'Importar datos',
    import_t: 'Abrir archivos de datos (CSV, TXT, DAT, log de LAMMPS…) como tablas nuevas',
    open_project: 'Abrir proyecto',
    save_project: 'Guardar proyecto',
    save_project_t: 'Guardar todo el proyecto en un archivo .plotit.json (Ctrl+S)',
    undo_t: 'Deshacer (Ctrl+Z)',
    redo_t: 'Rehacer (Ctrl+Y)',
    help_t: 'Ayuda (?)',
    new_table: '+ Tabla',
    new_graph: '+ Gráfica',
    tab_t: 'Doble clic para cambiar el nombre; clic con la rueda para cerrar',
    close_t: 'Cerrar',
    autoscale: 'Autoescala',
    autoscale_t: 'Ajustar los ejes a los datos (A o doble clic en la gráfica)',
    export_png: 'PNG',
    export_svg: 'SVG',
    empty_big: 'Escribe o pega tus datos',
    empty_html: 'Haz clic en una celda y escribe, pega desde Excel (<kbd>Ctrl</kbd>+<kbd>V</kbd>) o arrastra aquí un archivo de datos.',
    example: 'Cargar un ejemplo',
    example_name: 'Ejemplo',
    example_toast: 'Ejemplo cargado: en el panel Ajuste, pulsa Ajustar.',
    drop_big: 'Suelta los archivos aquí',
    drop_text: 'Los archivos de datos (CSV, TXT, DAT, log de LAMMPS…) se abren como tablas; un .plotit.json se abre como proyecto.',
    select_all: 'Seleccionar todo',
    row_number: 'nº de fila',
    none: '(ninguna)',
    auto: 'auto',
    all: 'todo',
    apply: 'Aplicar',
    copy: 'Copiar',
    copied: 'Copiado',
    copy_fail: 'No se ha podido copiar',
    clear: 'Borrar',
    cancel: 'Cancelar',
    delete: 'Borrar',
    undo_hint: 'Se puede deshacer con Ctrl+Z.',

    // Columna
    p_column: 'Columna',
    col_name: 'Nombre',
    col_role: 'Papel en las gráficas',
    role_X: 'X',
    role_Y: 'Y',
    role_xErr: 'Error de X',
    role_yErr: 'Error de Y',
    role_none: 'Ninguno',
    col_unit: 'Unidad o comentario',
    col_unit_ph: 'p. ej. nm, K, ps',
    formula_head: 'Valores por fórmula',
    formula_ph: 'p. ej.  sqrt(B)/2   o   A^2 + cell("B", i-1)',
    rows_from: 'Filas',
    rows_to: 'a',
    hint_formula_html: '<code>i</code> es el número de fila; las columnas se usan por su nombre o con <code>col("nombre")</code>, y <code>cell("A", i-1)</code> lee otra fila. <kbd>Enter</kbd> aplica.',
    formula_bad: ({ n }) => (n === 1 ? 'Una fila no da un número y se ha dejado vacía.' : `${n} filas no dan un número y se han dejado vacías.`),
    ops_head: 'Operaciones',
    sort_asc: 'Ordenar ↑',
    sort_desc: 'Ordenar ↓',
    sort_t: 'Ordenar toda la tabla según esta columna',
    normalize: 'Normalizar',
    normalize_t: 'Dividir la columna por su mayor valor absoluto',
    deriv: 'd/dX',
    deriv_t: 'Columna nueva con la derivada respecto a su X (diferencias centradas)',
    integ: '∫ dX',
    integ_t: 'Columna nueva con la integral acumulada respecto a su X (trapecios); el área total va al registro',
    area: 'Área total: {v}',

    // Representar
    p_plotnew: 'Representar',
    st_scatter: 'Puntos',
    st_line: 'Línea',
    st_both: 'Línea y puntos',
    plot_dest: 'Destino',
    plot_btn: 'Representar',
    plot_new_graph: 'en una gráfica nueva',
    plot_add_to: 'añadir a {name}',
    plot_need_y: 'Selecciona al menos una columna Y (clic en su cabecera).',
    hint_plot_html: 'Selecciona columnas Y (clic en la cabecera, <kbd>Ctrl</kbd>+clic para varias). Cada una se dibuja frente a la X que tenga a su izquierda, con las columnas de error que tenga a la derecha.',

    // Estadística
    p_stats: 'Estadística',
    hint_stats: 'De la selección, o de la columna entera si solo hay una celda seleccionada.',
    stats_none: 'No hay números en la selección',
    st_n: 'N',
    st_mean: 'Media',
    st_sd: 'Desv. típica',
    st_se: 'Error de la media',
    st_min: 'Mínimo',
    st_max: 'Máximo',
    st_sum: 'Suma',
    st_median: 'Mediana',

    // Tabla
    p_table: 'Tabla',
    tbl_name: 'Nombre',
    tbl_rows: 'Filas',
    add_col: '+ Columna',
    ins_rows: 'Insertar filas',
    ins_rows_t: 'Insertar encima de la selección tantas filas vacías como filas seleccionadas',
    del_rows: 'Borrar filas',
    del_cols: 'Borrar columnas',
    export_csv: 'Exportar CSV',
    pasted: '{r} × {c} celdas pegadas',
    shrink_title: '¿Reducir la tabla?',
    shrink_text: ({ n }) => (n === 1 ? 'Se borrará la última fila, que tiene datos.' : `Se borrarán las últimas ${n} filas, y algunas tienen datos.`),
    del_cols_title: ({ n }) => (n === 1 ? '¿Borrar la columna?' : `¿Borrar ${n} columnas?`),
    del_cols_used: 'Se usan en gráficas: esas curvas desaparecerán.',
    del_table_title: '¿Borrar la tabla {name}?',
    del_table_text: 'Tiene datos.',
    del_table_users: ({ n }) => (n === 1 ? 'Se usa en una gráfica: sus curvas desaparecerán.' : `Se usa en ${n} gráficas: sus curvas desaparecerán.`),
    csv_title: 'Exportar CSV',
    csv_text: '¿Para qué programa?',
    csv_detail: 'El Excel en español necesita punto y coma como separador y coma decimal.',
    csv_std: 'Estándar (, y punto)',
    csv_excel: 'Excel (; y coma decimal)',

    // Curvas
    p_curves: 'Curvas',
    no_curves: 'Esta gráfica no tiene curvas: añade datos o una función abajo.',
    curve_vis_t: 'Mostrar u ocultar',
    curve_color_t: 'Color',
    curve_del_t: 'Quitar de la gráfica',
    tag_fit: 'ajuste',
    c_label: 'Leyenda',
    c_table: 'Tabla',
    c_yerr: 'Error de Y',
    c_xerr: 'Error de X',
    c_style: 'Estilo',
    c_symbol: 'Símbolo',
    c_size: 'Tamaño',
    c_fill: 'Relleno',
    c_width: 'Grosor de línea',
    c_dash: 'Trazo',
    c_xmin: 'Desde x',
    c_xmax: 'Hasta x',
    c_points: 'Puntos',
    sym_circle: 'Círculo',
    sym_square: 'Cuadrado',
    sym_triangle: 'Triángulo',
    sym_diamond: 'Rombo',
    sym_down: 'Triángulo invertido',
    sym_cross: 'Aspa',
    sym_plus: 'Cruz',
    sym_star: 'Estrella',
    dash_solid: 'Continuo',
    dash_dash: 'Discontinuo',
    dash_dot: 'Punteado',
    dash_dashdot: 'Raya y punto',
    add_head: 'Añadir',
    add_table: 'Tabla',
    add_x: 'Columna X',
    add_y: 'Columna Y',
    add_data: '+ Datos',
    add_func: '+ Función',
    tip_row: 'fila {r}',

    // Ajuste
    p_fit: 'Ajuste',
    fit_curve: 'Datos',
    fit_model: 'Modelo',
    m_linear: 'Lineal',
    m_poly: 'Polinomio',
    m_exp_decay: 'Decaimiento exponencial',
    m_exp_growth: 'Crecimiento exponencial',
    m_gauss: 'Gaussiana',
    m_lorentz: 'Lorentziana',
    m_boltzmann: 'Sigmoide (Boltzmann)',
    m_power: 'Ley de potencias',
    m_sine: 'Seno',
    m_damped: 'Oscilación amortiguada',
    m_custom: 'Personalizado…',
    fit_deg: 'Grado',
    fit_param: 'Parámetro',
    fit_init: 'Valor',
    fit_fixed: 'Fijo',
    fit_fixed_t: 'No ajustar este parámetro',
    fit_xmin: 'Desde x',
    fit_xmax: 'Hasta x',
    fit_weight: 'Pesar con los errores de Y (1/σ²)',
    fit_weight_none: 'Los datos no tienen columna de error de Y',
    fit_err_zero: 'Hay errores de Y vacíos o nulos en el intervalo: no se puede pesar. Desmarca «Pesar» o completa los errores.',
    fit_guess: 'Estimar',
    fit_guess_t: 'Calcular otra vez los valores iniciales a partir de los datos',
    fit_run: 'Ajustar',
    fit_table: 'Residuos → tabla',
    fit_table_t: 'Tabla nueva con x, y, el valor del ajuste y el residuo de cada punto',
    hint_fit_html: '<kbd>Mayús</kbd>+arrastrar sobre la gráfica elige el intervalo de x. En el modelo personalizado, todo nombre distinto de <code>x</code> es un parámetro. Sin pesos, los errores se escalan con √(χ²/ν).',
    fit_no_data: 'La gráfica no tiene datos',
    fit_no_params: 'La expresión no tiene parámetros que ajustar.',
    fit_no_points: 'No hay puntos que ajustar en ese intervalo.',
    fit_fail_no_data: 'No hay puntos que ajustar en ese intervalo.',
    fit_fail_no_free: 'Todos los parámetros están fijos: no hay nada que ajustar.',
    fit_fail_few_points: 'Hacen falta al menos {n} puntos para tantos parámetros libres.',
    fit_fail_init_nan: 'El modelo no se puede evaluar con los valores iniciales (da NaN o infinito). Cámbialos o pulsa Estimar.',
    fit_npts: '{n} puntos',
    fit_weighted: 'pesado con 1/σ²',
    fit_unweighted: 'sin pesos',
    fit_err_note: 'Ajuste sin pesos: errores escalados con √(χ²/ν).',
    fit_converged: 'Convergió en {n} iteraciones.',
    fit_not_converged: 'No ha convergido en {n} iteraciones: revisa el resultado o los valores iniciales.',
    fit_label: 'Ajuste',

    // Ejes
    p_axes: 'Ejes y diseño',
    g_title: 'Título',
    g_xlab: 'Título del eje X',
    g_ylab: 'Título del eje Y',
    g_xmin: 'X mín.',
    g_xmax: 'X máx.',
    g_ymin: 'Y mín.',
    g_ymax: 'Y máx.',
    g_xlog: 'X logarítmico',
    g_ylog: 'Y logarítmico',
    g_grid: 'Rejilla',
    g_legend: 'Leyenda',
    lg_auto: 'Automática',
    lg_tr: 'Arriba a la derecha',
    lg_tl: 'Arriba a la izquierda',
    lg_br: 'Abajo a la derecha',
    lg_bl: 'Abajo a la izquierda',
    lg_off: 'Oculta',
    g_w: 'Ancho (px)',
    g_h: 'Alto (px)',
    g_font: 'Tamaño de letra',
    g_pngscale: 'Escala del PNG',
    hint_axes_html: 'En los textos: <code>x_{0}</code> subíndice, <code>m^{2}</code> o <code>s^-1</code> superíndice, <code>\\alpha</code>, <code>\\AA</code> (Å), <code>\\deg</code> (°)… La hoja blanca es exactamente lo que se exporta.',

    // Registro
    p_log: 'Registro de resultados',
    log_empty: 'Aquí aparecen los ajustes, las integrales y las normalizaciones.',

    // Archivos y proyecto
    import_ok: ({ name, rows, cols, blocks }) => `${name}: ${rows} filas × ${cols} columnas` + (blocks > 1 ? ` (${blocks} bloques unidos)` : ''),
    import_none: 'No se han encontrado columnas de números en {name}.',
    import_many: '{n} archivos importados',
    proj_invalid: 'El archivo no es un JSON válido.',
    proj_not_plotit: 'No es un proyecto de PlotIt.',
    proj_loaded: 'Proyecto cargado',
    resume_title: '¿Recuperar el trabajo anterior?',
    resume_text: ({ t, g }) => `Hay un proyecto sin guardar con ${t === 1 ? 'una tabla' : t + ' tablas'} y ${g === 1 ? 'una gráfica' : g + ' gráficas'}.`,
    resume_detail: 'Se guarda solo en este navegador mientras trabajas.',
    recover: 'Recuperar',
    start_fresh: 'Empezar de cero',

    // Errores de las expresiones
    expr_char: 'Carácter no válido «{arg}» (posición {pos}).',
    expr_end: 'La expresión está incompleta.',
    expr_expected: 'Falta «{arg}» en la posición {pos}.',
    expr_unexpected: 'Sobra «{arg}» en la posición {pos}.',
    expr_missing_op: 'Falta un operador antes de «{arg}» (posición {pos}). ¿Un * olvidado?',
    expr_empty: 'La expresión está vacía.',
    expr_string: 'Hay texto entre comillas fuera de col() o cell() (posición {pos}).',
    expr_unknown_var: '«{arg}» no es una variable conocida (posición {pos}).',
    expr_unknown_col: 'No hay ninguna columna «{arg}».',
    expr_no_col: 'col() solo se puede usar en las fórmulas de columna.',
    expr_unknown_func: 'No existe la función «{arg}».',
    expr_arity: 'Número de argumentos incorrecto en {arg}().',

    // Ayuda
    help_title: 'Cómo se usa',
    help_ok: 'Entendido',
    help_html: `<h3>Tablas</h3>
    <ul>
    <li>Haz clic en una celda y escribe; <kbd>Enter</kbd> y <kbd>Tab</kbd> pasan a la siguiente. <kbd>F2</kbd> o doble clic edita la celda; <kbd>Supr</kbd> borra la selección.</li>
    <li>Copia y pega con Excel, LibreOffice o SciDAVis (<kbd>Ctrl</kbd>+<kbd>C</kbd> / <kbd>V</kbd> / <kbd>X</kbd>). Si pegas en la fila 1 con una línea de títulos, se usan como nombres de columna. Se acepta la coma decimal.</li>
    <li>Clic en una cabecera selecciona la columna (<kbd>Mayús</kbd> para un rango, <kbd>Ctrl</kbd> para sueltas); doble clic, su nombre. El borde derecho de la cabecera cambia el ancho.</li>
    <li>Cada columna tiene un papel: X, Y, error de X, error de Y o ninguno. Una Y se dibuja frente a la X de su izquierda, con los errores que tenga a su derecha.</li>
    </ul>
    <h3>Fórmulas</h3>
    <ul>
    <li>Operadores <code>+ − * / ^ %</code>, comparaciones (<code>&lt; &gt; == …</code>, valen 1 o 0) y <code>condición ? a : b</code>.</li>
    <li>Funciones: <code>sin cos tan asin acos atan atan2 sinh cosh tanh exp ln log</code> (base 10) <code>log2 sqrt cbrt abs sign floor ceil round min max hypot pow mod erf erfc gamma rand if</code>. Constantes <code>pi</code> y <code>e</code>.</li>
    <li><code>i</code> es el número de fila; las columnas se usan por su nombre (<code>B*2</code>) o con <code>col("nombre con espacios")</code>; <code>cell("A", i-1)</code> lee el valor de otra fila.</li>
    </ul>
    <h3>Gráficas</h3>
    <ul>
    <li>Selecciona las columnas Y y pulsa <b>Representar</b>, o añade datos y funciones en el panel Curvas.</li>
    <li>Rueda: zoom (<kbd>Mayús</kbd> solo en x, <kbd>Alt</kbd> solo en y). Arrastrar: desplazar. Doble clic o <kbd>A</kbd>: autoescala. Al pasar sobre un punto se ve su valor.</li>
    <li>La hoja blanca es lo que se exporta a PNG o SVG, con su tamaño y su letra (panel Ejes). En los textos, <code>x_{0}</code>, <code>m^{2}</code>, <code>\\alpha</code>, <code>\\AA</code>…</li>
    </ul>
    <h3>Ajustes</h3>
    <ul>
    <li>Elige los datos y el modelo, o escribe el tuyo: cualquier nombre que no sea <code>x</code> es un parámetro. <kbd>Mayús</kbd>+arrastrar en la gráfica limita el intervalo.</li>
    <li>Levenberg–Marquardt, pesado con 1/σ² si hay errores de Y. Se dan los parámetros con su error, χ²/ν, R² y RMSE; el resultado va también al registro.</li>
    </ul>
    <h3>Archivos</h3>
    <ul>
    <li><b>Importar datos</b> lee CSV, TXT, DAT y logs de LAMMPS: detecta el separador, la coma decimal y la cabecera, y une los bloques con la misma cabecera (varios <code>run</code>).</li>
    <li><b>Guardar proyecto</b> (<kbd>Ctrl</kbd>+<kbd>S</kbd>) guarda tablas, gráficas y registro en un <code>.plotit.json</code>. Además, el trabajo se guarda solo en el navegador.</li>
    <li><kbd>Ctrl</kbd>+<kbd>Z</kbd> / <kbd>Ctrl</kbd>+<kbd>Y</kbd> deshacen y rehacen; <kbd>?</kbd> abre esta ayuda.</li>
    </ul>`,
  },

  en: {
    meta_desc: 'Data analysis and plotting in the browser: tables with formulas, publication-quality graphs and nonlinear curve fitting.',
    lang_t: 'Language',
    import: 'Import data',
    import_t: 'Open data files (CSV, TXT, DAT, LAMMPS log…) as new tables',
    open_project: 'Open project',
    save_project: 'Save project',
    save_project_t: 'Save the whole project to a .plotit.json file (Ctrl+S)',
    undo_t: 'Undo (Ctrl+Z)',
    redo_t: 'Redo (Ctrl+Y)',
    help_t: 'Help (?)',
    new_table: '+ Table',
    new_graph: '+ Graph',
    tab_t: 'Double-click to rename; middle-click to close',
    close_t: 'Close',
    autoscale: 'Autoscale',
    autoscale_t: 'Fit the axes to the data (A or double-click on the graph)',
    export_png: 'PNG',
    export_svg: 'SVG',
    empty_big: 'Type or paste your data',
    empty_html: 'Click a cell and type, paste from Excel (<kbd>Ctrl</kbd>+<kbd>V</kbd>) or drop a data file here.',
    example: 'Load an example',
    example_name: 'Example',
    example_toast: 'Example loaded: press Fit in the Fit panel.',
    drop_big: 'Drop files here',
    drop_text: 'Data files (CSV, TXT, DAT, LAMMPS log…) become tables; a .plotit.json file opens as a project.',
    select_all: 'Select all',
    row_number: 'row number',
    none: '(none)',
    auto: 'auto',
    all: 'all',
    apply: 'Apply',
    copy: 'Copy',
    copied: 'Copied',
    copy_fail: 'Could not copy',
    clear: 'Clear',
    cancel: 'Cancel',
    delete: 'Delete',
    undo_hint: 'You can undo it with Ctrl+Z.',

    p_column: 'Column',
    col_name: 'Name',
    col_role: 'Plot role',
    role_X: 'X',
    role_Y: 'Y',
    role_xErr: 'X error',
    role_yErr: 'Y error',
    role_none: 'None',
    col_unit: 'Unit or comment',
    col_unit_ph: 'e.g. nm, K, ps',
    formula_head: 'Set values from a formula',
    formula_ph: 'e.g.  sqrt(B)/2   or   A^2 + cell("B", i-1)',
    rows_from: 'Rows',
    rows_to: 'to',
    hint_formula_html: '<code>i</code> is the row number; use columns by name or with <code>col("name")</code>, and <code>cell("A", i-1)</code> reads another row. <kbd>Enter</kbd> applies.',
    formula_bad: ({ n }) => (n === 1 ? 'One row did not give a number and was left empty.' : `${n} rows did not give a number and were left empty.`),
    ops_head: 'Operations',
    sort_asc: 'Sort ↑',
    sort_desc: 'Sort ↓',
    sort_t: 'Sort the whole table by this column',
    normalize: 'Normalize',
    normalize_t: 'Divide the column by its largest absolute value',
    deriv: 'd/dX',
    deriv_t: 'New column with the derivative with respect to its X (centred differences)',
    integ: '∫ dX',
    integ_t: 'New column with the cumulative integral over its X (trapezoids); the total area goes to the log',
    area: 'Total area: {v}',

    p_plotnew: 'Plot',
    st_scatter: 'Scatter',
    st_line: 'Line',
    st_both: 'Line + symbols',
    plot_dest: 'Destination',
    plot_btn: 'Plot',
    plot_new_graph: 'in a new graph',
    plot_add_to: 'add to {name}',
    plot_need_y: 'Select at least one Y column (click its header).',
    hint_plot_html: 'Select Y columns (click the header, <kbd>Ctrl</kbd>+click for several). Each is plotted against the X column on its left, with the error columns on its right.',

    p_stats: 'Statistics',
    hint_stats: 'Of the selection, or of the whole column when a single cell is selected.',
    stats_none: 'No numbers in the selection',
    st_n: 'N',
    st_mean: 'Mean',
    st_sd: 'Std. dev.',
    st_se: 'Std. error',
    st_min: 'Min',
    st_max: 'Max',
    st_sum: 'Sum',
    st_median: 'Median',

    p_table: 'Table',
    tbl_name: 'Name',
    tbl_rows: 'Rows',
    add_col: '+ Column',
    ins_rows: 'Insert rows',
    ins_rows_t: 'Insert as many empty rows as are selected, above the selection',
    del_rows: 'Delete rows',
    del_cols: 'Delete columns',
    export_csv: 'Export CSV',
    pasted: '{r} × {c} cells pasted',
    shrink_title: 'Shrink the table?',
    shrink_text: ({ n }) => (n === 1 ? 'The last row, which has data, will be deleted.' : `The last ${n} rows will be deleted, and some have data.`),
    del_cols_title: ({ n }) => (n === 1 ? 'Delete the column?' : `Delete ${n} columns?`),
    del_cols_used: 'They are used in graphs: those curves will disappear.',
    del_table_title: 'Delete table {name}?',
    del_table_text: 'It has data.',
    del_table_users: ({ n }) => (n === 1 ? 'It is used in a graph: its curves will disappear.' : `It is used in ${n} graphs: its curves will disappear.`),
    csv_title: 'Export CSV',
    csv_text: 'Which program is it for?',
    csv_detail: 'Excel with a Spanish (or other decimal-comma) locale needs semicolons and decimal commas.',
    csv_std: 'Standard (, and point)',
    csv_excel: 'Excel (; and decimal comma)',

    p_curves: 'Curves',
    no_curves: 'This graph has no curves: add data or a function below.',
    curve_vis_t: 'Show or hide',
    curve_color_t: 'Colour',
    curve_del_t: 'Remove from the graph',
    tag_fit: 'fit',
    c_label: 'Legend',
    c_table: 'Table',
    c_yerr: 'Y error',
    c_xerr: 'X error',
    c_style: 'Style',
    c_symbol: 'Symbol',
    c_size: 'Size',
    c_fill: 'Filled',
    c_width: 'Line width',
    c_dash: 'Dash',
    c_xmin: 'From x',
    c_xmax: 'To x',
    c_points: 'Points',
    sym_circle: 'Circle',
    sym_square: 'Square',
    sym_triangle: 'Triangle',
    sym_diamond: 'Diamond',
    sym_down: 'Down triangle',
    sym_cross: 'Cross',
    sym_plus: 'Plus',
    sym_star: 'Star',
    dash_solid: 'Solid',
    dash_dash: 'Dashed',
    dash_dot: 'Dotted',
    dash_dashdot: 'Dash-dot',
    add_head: 'Add',
    add_table: 'Table',
    add_x: 'X column',
    add_y: 'Y column',
    add_data: '+ Data',
    add_func: '+ Function',
    tip_row: 'row {r}',

    p_fit: 'Fit',
    fit_curve: 'Data',
    fit_model: 'Model',
    m_linear: 'Linear',
    m_poly: 'Polynomial',
    m_exp_decay: 'Exponential decay',
    m_exp_growth: 'Exponential growth',
    m_gauss: 'Gaussian',
    m_lorentz: 'Lorentzian',
    m_boltzmann: 'Sigmoid (Boltzmann)',
    m_power: 'Power law',
    m_sine: 'Sine',
    m_damped: 'Damped oscillation',
    m_custom: 'Custom…',
    fit_deg: 'Degree',
    fit_param: 'Parameter',
    fit_init: 'Value',
    fit_fixed: 'Fixed',
    fit_fixed_t: 'Do not fit this parameter',
    fit_xmin: 'From x',
    fit_xmax: 'To x',
    fit_weight: 'Weight with Y errors (1/σ²)',
    fit_weight_none: 'The data have no Y error column',
    fit_err_zero: 'Some Y errors in the range are empty or zero, so the fit cannot be weighted. Untick “Weight” or fill in the errors.',
    fit_guess: 'Guess',
    fit_guess_t: 'Recompute the initial values from the data',
    fit_run: 'Fit',
    fit_table: 'Residuals → table',
    fit_table_t: 'New table with x, y, the fitted value and the residual of each point',
    hint_fit_html: '<kbd>Shift</kbd>+drag on the graph sets the x range. In a custom model, every name other than <code>x</code> is a parameter. Without weights, errors are scaled by √(χ²/ν).',
    fit_no_data: 'The graph has no data',
    fit_no_params: 'The expression has no parameters to fit.',
    fit_no_points: 'There are no points to fit in that range.',
    fit_fail_no_data: 'There are no points to fit in that range.',
    fit_fail_no_free: 'All parameters are fixed: there is nothing to fit.',
    fit_fail_few_points: 'At least {n} points are needed for that many free parameters.',
    fit_fail_init_nan: 'The model cannot be evaluated with the initial values (it gives NaN or infinity). Change them or press Guess.',
    fit_npts: '{n} points',
    fit_weighted: 'weighted with 1/σ²',
    fit_unweighted: 'unweighted',
    fit_err_note: 'Unweighted fit: errors scaled by √(χ²/ν).',
    fit_converged: 'Converged in {n} iterations.',
    fit_not_converged: 'Did not converge in {n} iterations: check the result or the initial values.',
    fit_label: 'Fit',

    p_axes: 'Axes and layout',
    g_title: 'Title',
    g_xlab: 'X axis title',
    g_ylab: 'Y axis title',
    g_xmin: 'X min',
    g_xmax: 'X max',
    g_ymin: 'Y min',
    g_ymax: 'Y max',
    g_xlog: 'Log X',
    g_ylog: 'Log Y',
    g_grid: 'Grid',
    g_legend: 'Legend',
    lg_auto: 'Automatic',
    lg_tr: 'Top right',
    lg_tl: 'Top left',
    lg_br: 'Bottom right',
    lg_bl: 'Bottom left',
    lg_off: 'Hidden',
    g_w: 'Width (px)',
    g_h: 'Height (px)',
    g_font: 'Font size',
    g_pngscale: 'PNG scale',
    hint_axes_html: 'In texts: <code>x_{0}</code> subscript, <code>m^{2}</code> or <code>s^-1</code> superscript, <code>\\alpha</code>, <code>\\AA</code> (Å), <code>\\deg</code> (°)… The white page is exactly what gets exported.',

    p_log: 'Results log',
    log_empty: 'Fits, integrals and normalizations show up here.',

    import_ok: ({ name, rows, cols, blocks }) => `${name}: ${rows} rows × ${cols} columns` + (blocks > 1 ? ` (${blocks} blocks joined)` : ''),
    import_none: 'No numeric columns found in {name}.',
    import_many: '{n} files imported',
    proj_invalid: 'The file is not valid JSON.',
    proj_not_plotit: 'This is not a PlotIt project.',
    proj_loaded: 'Project loaded',
    resume_title: 'Recover your previous work?',
    resume_text: ({ t, g }) => `There is an unsaved project with ${t === 1 ? 'one table' : t + ' tables'} and ${g === 1 ? 'one graph' : g + ' graphs'}.`,
    resume_detail: 'It is kept only in this browser while you work.',
    recover: 'Recover',
    start_fresh: 'Start fresh',

    expr_char: 'Invalid character “{arg}” (position {pos}).',
    expr_end: 'The expression is incomplete.',
    expr_expected: 'Missing “{arg}” at position {pos}.',
    expr_unexpected: 'Unexpected “{arg}” at position {pos}.',
    expr_missing_op: 'Missing operator before “{arg}” (position {pos}). A forgotten *?',
    expr_empty: 'The expression is empty.',
    expr_string: 'Quoted text outside col() or cell() (position {pos}).',
    expr_unknown_var: '“{arg}” is not a known variable (position {pos}).',
    expr_unknown_col: 'There is no column “{arg}”.',
    expr_no_col: 'col() can only be used in column formulas.',
    expr_unknown_func: 'There is no function “{arg}”.',
    expr_arity: 'Wrong number of arguments in {arg}().',

    help_title: 'How to use it',
    help_ok: 'Got it',
    help_html: `<h3>Tables</h3>
    <ul>
    <li>Click a cell and type; <kbd>Enter</kbd> and <kbd>Tab</kbd> move on. <kbd>F2</kbd> or double-click edits the cell; <kbd>Del</kbd> clears the selection.</li>
    <li>Copy and paste with Excel, LibreOffice or SciDAVis (<kbd>Ctrl</kbd>+<kbd>C</kbd> / <kbd>V</kbd> / <kbd>X</kbd>). Pasting at row 1 with a line of titles uses them as column names. Decimal commas are accepted.</li>
    <li>Clicking a header selects the column (<kbd>Shift</kbd> for a range, <kbd>Ctrl</kbd> for separate ones); double-click edits its name. Drag the right edge of a header to resize.</li>
    <li>Each column has a role: X, Y, X error, Y error or none. A Y column is plotted against the X on its left, with the error columns on its right.</li>
    </ul>
    <h3>Formulas</h3>
    <ul>
    <li>Operators <code>+ − * / ^ %</code>, comparisons (<code>&lt; &gt; == …</code>, giving 1 or 0) and <code>condition ? a : b</code>.</li>
    <li>Functions: <code>sin cos tan asin acos atan atan2 sinh cosh tanh exp ln log</code> (base 10) <code>log2 sqrt cbrt abs sign floor ceil round min max hypot pow mod erf erfc gamma rand if</code>. Constants <code>pi</code> and <code>e</code>.</li>
    <li><code>i</code> is the row number; use columns by name (<code>B*2</code>) or with <code>col("name with spaces")</code>; <code>cell("A", i-1)</code> reads the value in another row.</li>
    </ul>
    <h3>Graphs</h3>
    <ul>
    <li>Select the Y columns and press <b>Plot</b>, or add data and functions in the Curves panel.</li>
    <li>Wheel: zoom (<kbd>Shift</kbd> x only, <kbd>Alt</kbd> y only). Drag: pan. Double-click or <kbd>A</kbd>: autoscale. Hover over a point to read its value.</li>
    <li>The white page is what gets exported to PNG or SVG, with its size and font (Axes panel). In texts, <code>x_{0}</code>, <code>m^{2}</code>, <code>\\alpha</code>, <code>\\AA</code>…</li>
    </ul>
    <h3>Fits</h3>
    <ul>
    <li>Choose the data and the model, or write your own: every name other than <code>x</code> is a parameter. <kbd>Shift</kbd>+drag on the graph limits the range.</li>
    <li>Levenberg–Marquardt, weighted with 1/σ² when there are Y errors. You get the parameters with their errors, χ²/ν, R² and RMSE; the result also goes to the log.</li>
    </ul>
    <h3>Files</h3>
    <ul>
    <li><b>Import data</b> reads CSV, TXT, DAT and LAMMPS logs: it detects the delimiter, decimal commas and the header, and joins blocks with the same header (several <code>run</code>s).</li>
    <li><b>Save project</b> (<kbd>Ctrl</kbd>+<kbd>S</kbd>) stores tables, graphs and log in a <code>.plotit.json</code> file. Your work is also kept automatically in the browser.</li>
    <li><kbd>Ctrl</kbd>+<kbd>Z</kbd> / <kbd>Ctrl</kbd>+<kbd>Y</kbd> undo and redo; <kbd>?</kbd> opens this help.</li>
    </ul>`,
  },
};

const LANG_KEY = 'plotit-lang';
let LANG = (() => {
  try { const s = localStorage.getItem(LANG_KEY); if (s === 'es' || s === 'en') return s; } catch (e) { /* sin almacenamiento */ }
  return /^es\b/i.test(navigator.language || '') ? 'es' : 'en';
})();

function t(key, vars = {}) {
  const v = (I18N[LANG] && I18N[LANG][key]) ?? I18N.es[key] ?? key;
  if (typeof v === 'function') return v(vars);
  return v.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
}

// Aplica el idioma a los textos fijos del HTML.
function applyStaticLang() {
  document.documentElement.lang = LANG;
  document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-html]').forEach((el) => { el.innerHTML = t(el.dataset.i18nHtml); });
  document.querySelectorAll('[data-i18n-title]').forEach((el) => { el.title = t(el.dataset.i18nTitle); });
  document.querySelectorAll('[data-i18n-aria]').forEach((el) => { el.setAttribute('aria-label', t(el.dataset.i18nAria)); });
  document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => { el.placeholder = t(el.dataset.i18nPlaceholder); });
  const meta = document.querySelector('meta[name="description"]');
  if (meta) meta.content = t('meta_desc');
  document.querySelectorAll('.lang-btn').forEach((b) => b.classList.toggle('active', b.dataset.lang === LANG));
}

function setLang(lang) {
  if (lang === LANG || !I18N[lang]) return;
  LANG = lang;
  try { localStorage.setItem(LANG_KEY, lang); } catch (e) { /* sin almacenamiento */ }
  applyStaticLang();
  document.dispatchEvent(new Event('langchange'));
}

applyStaticLang();
