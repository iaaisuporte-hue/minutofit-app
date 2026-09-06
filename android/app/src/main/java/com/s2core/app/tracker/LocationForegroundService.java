package com.s2core.app.tracker;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ServiceInfo;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Build;
import android.os.Bundle;
import android.os.IBinder;
import android.os.Looper;
import android.util.Log;

import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;

import java.util.concurrent.ConcurrentLinkedQueue;

/**
 * Serviço de primeiro plano que mantém a coleta de GPS viva com o app em
 * segundo plano e a tela bloqueada.
 *
 * ## Por que um serviço, e não JavaScript
 *
 * Quando o WebView deixa de ser visível o sistema suspende o JavaScript: nenhum
 * `setInterval` corre e nenhum callback de `watchPosition` chega. Não é ajuste
 * de configuração — é o ciclo de vida do Android. A única forma de continuar
 * recebendo posição é um componente nativo com ciclo de vida próprio, e para
 * localização o Android exige que ele seja um serviço de primeiro plano com
 * `foregroundServiceType="location"` e notificação persistente.
 *
 * ## Por que os pontos ficam numa fila
 *
 * Enquanto o WebView está suspenso não adianta emitir evento para ele: a ponte
 * não entrega, ou entrega e o JavaScript não roda para receber. Então o serviço
 * ACUMULA aqui e o lado web DRENA quando volta ao primeiro plano. Emitir ao
 * vivo continua acontecendo quando há alguém escutando — as duas coisas
 * convivem, e o `sequencia` deixa o consumidor descartar repetição.
 *
 * ## Por que LocationManager e não FusedLocationProvider
 *
 * O fused é melhor, mas mora em `play-services-location`, uma dependência que
 * este projeto não tem. Para uma corrida ao ar livre, com `GPS_PROVIDER` e
 * `enableHighAccuracy` implícito, a diferença é pequena perto do custo de
 * arrastar o Google Play Services para dentro do build — e o filtro de
 * trajetória do lado web já descarta o ruído que sobra.
 *
 * ## Permissão de segundo plano
 *
 * `ACCESS_BACKGROUND_LOCATION` NÃO é declarada de propósito. Um serviço de
 * primeiro plano do tipo `location`, iniciado enquanto o app está visível,
 * mantém acesso à localização sem ela — e pedir essa permissão obrigaria a uma
 * declaração específica na Play Store, com vídeo de demonstração e revisão
 * própria. O gatilho aqui é sempre um toque em "iniciar atividade", com o app
 * na tela, então a condição é satisfeita.
 */
public class LocationForegroundService extends Service {

    public static final String ACTION_START = "com.s2core.app.tracker.START";
    public static final String ACTION_PAUSE = "com.s2core.app.tracker.PAUSE";
    public static final String ACTION_RESUME = "com.s2core.app.tracker.RESUME";
    public static final String ACTION_STOP = "com.s2core.app.tracker.STOP";

    public static final String EXTRA_TITLE = "titulo";
    public static final String EXTRA_TEXT = "texto";

    private static final String TAG = "S2CoreTracker";
    private static final String CANAL_ID = "s2core_tracker";
    private static final int NOTIFICACAO_ID = 4711;

    /** Intervalo mínimo entre entregas. O receptor decide quando tem posição. */
    private static final long INTERVALO_MS = 1000L;
    /** Sem distância mínima: quem decide o que é movimento é o filtro do web. */
    private static final float DISTANCIA_MINIMA_M = 0f;

    /** Teto da fila. Uma corrida de 3 h a 1 Hz cabe folgada; o teto existe para
     *  um app esquecido em segundo plano não crescer sem limite na memória. */
    private static final int LIMITE_FILA = 20000;

    /** Estático porque quem drena é o plugin, que vive noutro objeto e pode ser
     *  recriado quando o WebView reinicia — a fila precisa sobreviver a isso. */
    private static final ConcurrentLinkedQueue<PontoNativo> FILA = new ConcurrentLinkedQueue<>();

    private static volatile boolean ativo = false;
    private static volatile boolean pausado = false;
    private static long sequencia = 0L;

    private LocationManager locationManager;
    private LocationListener listener;

    /** Último texto pedido pelo web, para pausa e retomada reusarem o título. */
    private String tituloAtual;
    private String textoAtual;

    public static boolean estaAtivo() {
        return ativo;
    }

    public static boolean estaPausado() {
        return pausado;
    }

    /** Esvazia a fila devolvendo o que havia. Chamado pelo plugin. */
    public static java.util.List<PontoNativo> drenar() {
        java.util.List<PontoNativo> saida = new java.util.ArrayList<>();
        PontoNativo p;
        while ((p = FILA.poll()) != null) saida.add(p);
        return saida;
    }

    public static void limparFila() {
        FILA.clear();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String acao = intent == null ? ACTION_START : intent.getAction();
        if (acao == null) acao = ACTION_START;

        switch (acao) {
            case ACTION_PAUSE:
                pausado = true;
                pararEscuta();
                atualizarNotificacao(tituloAtual, "Atividade pausada");
                break;
            case ACTION_RESUME:
                pausado = false;
                iniciarEscuta();
                atualizarNotificacao(tituloAtual, textoAtual);
                break;
            case ACTION_STOP:
                encerrar();
                return START_NOT_STICKY;
            case ACTION_START:
            default: {
                String titulo = intent != null ? intent.getStringExtra(EXTRA_TITLE) : null;
                String texto = intent != null ? intent.getStringExtra(EXTRA_TEXT) : null;
                // Um reinício do sistema (START_STICKY) chega com intent nulo:
                // preservar o texto anterior evita a notificação "piscar" para
                // o genérico no meio da corrida.
                if (titulo != null) tituloAtual = titulo;
                if (texto != null) textoAtual = texto;
                ativo = true;
                pausado = false;
                if (subirParaPrimeiroPlano(tituloAtual, textoAtual)) {
                    iniciarEscuta();
                }
                // Se subirParaPrimeiroPlano falhou, ele já chamou stopSelf() —
                // não faz sentido começar a escutar GPS para um serviço que já
                // está sendo derrubado.
                break;
            }
        }

        // START_STICKY: se o sistema matar o serviço por pressão de memória, ele
        // volta. O `intent` nulo cai no ramo START acima, que é o estado certo
        // para retomar — a atividade em si é reconstruída do rascunho no web.
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        pararEscuta();
        ativo = false;
        pausado = false;
        super.onDestroy();
    }

    // ── Notificação ─────────────────────────────────────────────────────────

    private void criarCanal() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager nm = getSystemService(NotificationManager.class);
        if (nm == null || nm.getNotificationChannel(CANAL_ID) != null) return;
        // IMPORTANCE_LOW: a notificação é obrigatória para o serviço existir,
        // mas não deve tocar som nem vibrar a cada retomada de corrida.
        NotificationChannel canal = new NotificationChannel(
                CANAL_ID, "Atividade em andamento", NotificationManager.IMPORTANCE_LOW);
        canal.setDescription("Mantém o registro de percurso ativo enquanto você treina.");
        canal.setShowBadge(false);
        nm.createNotificationChannel(canal);
    }

    private Notification construirNotificacao(String titulo, String texto) {
        criarCanal();

        Intent abrir = getPackageManager().getLaunchIntentForPackage(getPackageName());
        PendingIntent toque = null;
        if (abrir != null) {
            abrir.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            int flags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) flags |= PendingIntent.FLAG_IMMUTABLE;
            toque = PendingIntent.getActivity(this, 0, abrir, flags);
        }

        return new NotificationCompat.Builder(this, CANAL_ID)
                .setContentTitle(titulo != null ? titulo : "Atividade em andamento")
                .setContentText(texto != null ? texto : "Registrando seu percurso.")
                .setSmallIcon(android.R.drawable.ic_menu_mylocation)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setCategory(NotificationCompat.CATEGORY_SERVICE)
                .setContentIntent(toque)
                .build();
    }

    /**
     * Sobe o serviço para primeiro plano. `startForeground()` com tipo
     * `location` lança `SecurityException` se a permissão de localização não
     * estiver concedida NO INSTANTE da chamada — o plugin já checa antes de
     * enviar a ação, mas a janela entre a checagem e a entrega do Intent é uma
     * corrida real (embora estreita: exigiria a pessoa revogar a permissão nos
     * milissegundos entre o toque e o Android processar). Sem este try/catch,
     * essa corrida rara derrubaria o app inteiro em vez de só falhar o início
     * da atividade.
     */
    private boolean subirParaPrimeiroPlano(String titulo, String texto) {
        Notification n = construirNotificacao(titulo, texto);
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(NOTIFICACAO_ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION);
            } else {
                startForeground(NOTIFICACAO_ID, n);
            }
            return true;
        } catch (SecurityException e) {
            Log.w(TAG, "startForeground negado: " + e.getMessage());
            ativo = false;
            stopSelf();
            return false;
        }
    }

    private void atualizarNotificacao(String titulo, String texto) {
        NotificationManager nm = getSystemService(NotificationManager.class);
        if (nm != null) nm.notify(NOTIFICACAO_ID, construirNotificacao(titulo, texto));
    }

    // ── Escuta de posição ───────────────────────────────────────────────────

    private boolean temPermissaoDeLocalizacao() {
        return ContextCompat.checkSelfPermission(this, android.Manifest.permission.ACCESS_FINE_LOCATION)
                == PackageManager.PERMISSION_GRANTED
                || ContextCompat.checkSelfPermission(this, android.Manifest.permission.ACCESS_COARSE_LOCATION)
                == PackageManager.PERMISSION_GRANTED;
    }

    private void iniciarEscuta() {
        if (listener != null) return;
        if (!temPermissaoDeLocalizacao()) {
            Log.w(TAG, "sem permissao de localizacao; servico segue vivo sem coletar");
            return;
        }
        if (locationManager == null) locationManager = getSystemService(LocationManager.class);
        if (locationManager == null) return;

        listener = new LocationListener() {
            @Override
            public void onLocationChanged(Location location) {
                enfileirar(location);
            }

            // Obrigatórios abaixo da API 30; sem eles o app quebra em aparelhos
            // antigos com AbstractMethodError. minSdk deste projeto é 23.
            @Override public void onStatusChanged(String provider, int status, Bundle extras) { }
            @Override public void onProviderEnabled(String provider) { }
            @Override public void onProviderDisabled(String provider) { }
        };

        try {
            locationManager.requestLocationUpdates(
                    LocationManager.GPS_PROVIDER, INTERVALO_MS, DISTANCIA_MINIMA_M,
                    listener, Looper.getMainLooper());
        } catch (SecurityException | IllegalArgumentException e) {
            Log.w(TAG, "GPS_PROVIDER indisponivel: " + e.getMessage());
            listener = null;
        }
    }

    private void pararEscuta() {
        if (listener == null || locationManager == null) {
            listener = null;
            return;
        }
        try {
            locationManager.removeUpdates(listener);
        } catch (SecurityException ignored) {
            // Permissão revogada durante a atividade: nada a remover.
        }
        listener = null;
    }

    private void enfileirar(Location l) {
        if (pausado) return;
        if (FILA.size() >= LIMITE_FILA) FILA.poll();
        PontoNativo p = new PontoNativo();
        p.lat = l.getLatitude();
        p.lng = l.getLongitude();
        p.accuracy = l.hasAccuracy() ? (double) l.getAccuracy() : null;
        p.altitude = l.hasAltitude() ? l.getAltitude() : null;
        p.timestamp = l.getTime() > 0 ? l.getTime() : System.currentTimeMillis();
        p.sequencia = ++sequencia;
        FILA.add(p);
        // Ao vivo, quando há WebView acordado do outro lado. Com ele suspenso
        // esta chamada não chega a ninguém — e é por isso que a fila existe.
        BackgroundLocationPlugin.emitirAoVivo(p);
    }

    private void encerrar() {
        pararEscuta();
        ativo = false;
        pausado = false;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            stopForeground(Service.STOP_FOREGROUND_REMOVE);
        } else {
            stopForeground(true);
        }
        stopSelf();
    }

    /** Ponto cru, no mesmo formato que a porta `LocationTracker` do web espera. */
    public static class PontoNativo {
        public double lat;
        public double lng;
        public Double accuracy;
        public Double altitude;
        public long timestamp;
        public long sequencia;
    }
}
