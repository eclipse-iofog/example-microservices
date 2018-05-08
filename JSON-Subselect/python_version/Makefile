## Build with version number for test purposes
build:
	sudo docker build -t iofog/json-subselect:python-$(TAG) .
## Push with version number for test purposes
push:build
    sudo docker push iofog/json-subselect:python-$(TAG)
## Tag latest to verified version number
latest:
    sudo docker tag iofog/json-subselect:python-$(TAG) iofog/json-subselect
## Push latest
push-latest:latest
    sudo docker push iofog/json-subselect

## Same cmds for arm
build-arm:
    sudo docker build -t iofog/json-subselect-arm:python-$(TAG) -f Dockerfile-arm .
push-arm:build-arm
    sudo docker push iofog/json-subselect-arm:python-$(TAG)
latest-arm:
    sudo docker tag iofog/json-subselect-arm:python-$(TAG) iofog/json-subselect-arm
push-latest-arm:latest-arm
    sudo docker push iofog/json-subselect-arm
