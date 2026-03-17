package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"trade-import-dashboard/backend/internal/config"
	"trade-import-dashboard/backend/internal/database"
	"trade-import-dashboard/backend/internal/handlers"
	"trade-import-dashboard/backend/internal/router"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("load config: %v", err)
	}

	db, err := database.Connect(cfg.DSN())
	if err != nil {
		log.Fatalf("db connection: %v", err)
	}

	if err := database.Migrate(db); err != nil {
		log.Fatalf("db migration: %v", err)
	}
	if err := database.SeedDefaults(db); err != nil {
		log.Fatalf("db seed defaults: %v", err)
	}

	h := handlers.New(db)
	r := router.New(cfg, h)

	srv := &http.Server{
		Addr:              fmt.Sprintf(":%s", cfg.AppPort),
		Handler:           r,
		ReadHeaderTimeout: 10 * time.Second,
	}

	go func() {
		log.Printf("backend running on :%s", cfg.AppPort)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("listen and serve: %v", err)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Fatalf("graceful shutdown failed: %v", err)
	}

	log.Print("server stopped")
}
