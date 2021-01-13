## Build with version number for test purposes
build:
	sudo docker build -t iofog/diagnostics:$(TAG) .
## Push with version number for test purposes
push:build
    sudo docker push iofog/diagnostics:$(TAG)
## Tag latest to verified version number
latest:
    sudo docker tag iofog/diagnostics:$(TAG) iofog/diagnostics
## Push latest
push-latest:latest
    sudo docker push iofog/diagnostics
## Same cmds for arm
build-arm:
    sudo docker build -t iofog/diagnostics-arm:$(TAG) -f Dockerfile-arm .
push-arm:build-arm
    sudo docker push iofog/diagnostics-arm:$(TAG)
latest-arm:
    sudo docker tag iofog/diagnostics-arm:$(TAG) iofog/diagnostics-arm
push-latest-arm:latest-arm
    sudo docker push iofog/diagnostics-arm